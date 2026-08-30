using AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;
using CaseExtensions;
using Microsoft.OpenApi;
using System.Globalization;
using System.Reflection;
using System.Text.Json.Nodes;

namespace AiZaya.Shared.Feature.OpenApi.Parsers;

public delegate string ResponsePatternName(string? name);

internal sealed class ResponseParser<TKey>(Response<TKey> response, ResponsePatternName responsePatternName)
    where TKey : notnull
{
    internal Dictionary<TKey, OpenApiResponse> GetMapOpenApiResponse()
    {
        var responses = new Dictionary<TKey, OpenApiResponse>();
        var mapOpenApiSchemas = GetMapOpenApiSchema();

        foreach (var mapOpenApiSchema in mapOpenApiSchemas)
        {
            var openApiResponse = new OpenApiResponse();
            var responseContent = new Dictionary<string, OpenApiMediaType>();
            var responseContentMediaType = new OpenApiMediaType();
            var modelType = response.Map[mapOpenApiSchema.Key];
            var referenceId = mapOpenApiSchema.Value.Title ?? string.Empty;
            var schemaReference = new OpenApiSchemaReference(referenceId);

            responseContentMediaType.Schema = schemaReference;
            responseContent["AiZaya/json"] = responseContentMediaType;
            openApiResponse.Content = responseContent;

            if (modelType.GetCustomAttribute<DescriptionAttribute>() is { Description: var description })
            {
                openApiResponse.Description = description;
            }

            responses.Add(mapOpenApiSchema.Key, openApiResponse);
        }

        return responses;
    }

    internal Dictionary<TKey, OpenApiSchema> GetMapOpenApiSchema()
    {
        var schemas = new Dictionary<TKey, OpenApiSchema>();

        foreach (var item in response.Map)
        {
            var type = item.Value;
            var openApiSchema = new OpenApiSchema
            {
                Title = responsePatternName(type.GetCustomAttribute<TitleAttribute>() is { Title: var title }
                    ? title
                    : type.Name),
                Type = JsonSchemaType.Object,
                Properties = GetOpenApiSchemaProperties(type.GetProperties())
            };

            schemas.TryAdd(item.Key, openApiSchema);
        }

        return schemas;
    }

    private Dictionary<string, IOpenApiSchema> GetOpenApiSchemaProperties(PropertyInfo[] properties)
    {
        var openApiProperties = new List<ResponseProperty>();

        foreach (var property in properties)
        {
            var propertyType = property.PropertyType;
            var propertyName = property.Name.ToCamelCase();
            var propertyOrder = 0;
            var propertyDescription = string.Empty;

            if (property.GetCustomAttribute<DescriptionAttribute>() is { Description: var description })
            {
                propertyDescription = description;
            }

            if (property.GetCustomAttribute<OrderAttribute>() is { Order: var order })
            {
                propertyOrder = order;
            }

            if (IsGenericType(propertyType))
            {
                var genericType = property.PropertyType.GetGenericArguments()[0];
                string referenceId;

                if (genericType.GetCustomAttribute<TitleAttribute>() is { Title: var genericTitle })
                {
                    referenceId = responsePatternName(genericTitle);
                }
                else
                {
                    referenceId = responsePatternName(genericType.Name);
                }

                var schemaProperty = new OpenApiSchema
                {
                    Type = JsonSchemaType.Object | JsonSchemaType.Array,
                    Description = propertyDescription,
                    Items = new OpenApiSchemaReference(referenceId)
                };

                openApiProperties.Add(new ResponseProperty(propertyName, propertyOrder, schemaProperty));

                continue;
            }

            if (!IsComplexType(propertyType))
            {
                var schemaProperty = new OpenApiSchema
                {
                    Description = propertyDescription,
                    Type = property.GetCustomAttribute<TypeAttribute>() is { Type: var type }
                        ? type
                        : GetJsonSchemaType(property)
                };

                if (property.GetCustomAttribute<PatternAttribute>() is { Pattern: var propertyPattern })
                {
                    schemaProperty.Pattern = propertyPattern;
                }

                if (property.GetCustomAttribute<FormatAttribute>() is { Format: var propertyFormat })
                {
                    schemaProperty.Format = propertyFormat;
                }

                if (property.GetCustomAttribute<EnumValueNumbersAttribute>() is { Type: var typeEnumValueNumbers })
                {
                    schemaProperty.Enum = GetValueNumbersFromEnumType(typeEnumValueNumbers);
                }

                if (property.GetCustomAttribute<EnumValueNamesAttribute>() is { Type: var typeEnumValueNames })
                {
                    schemaProperty.Enum = GetValueNamesFromEnumType(typeEnumValueNames);
                }

                openApiProperties.Add(new ResponseProperty(propertyName, propertyOrder, schemaProperty));
            }
            else
            {
                if (propertyType.GetCustomAttribute<TitleAttribute>() is { Title: var propertyTitle })
                {
                    var referenceId = responsePatternName(propertyTitle);
                    var schemaReference = new OpenApiSchemaReference(referenceId)
                    {
                        Description = propertyDescription
                    };

                    openApiProperties.Add(new ResponseProperty(propertyName, propertyOrder, schemaReference));
                }
                else
                {
                    var referenceId = responsePatternName(propertyType.Name);
                    var schemaReference = new OpenApiSchemaReference(referenceId)
                    {
                        Description = propertyDescription
                    };

                    openApiProperties.Add(new ResponseProperty(propertyName, propertyOrder, schemaReference));
                }
            }
        }

        return SortOpenApiSchemaProperties(openApiProperties);
    }

    private static JsonSchemaType GetJsonSchemaType(Type type)
    {
        return Type.GetTypeCode(type) switch
        {
            TypeCode.String => JsonSchemaType.String,
            TypeCode.Int32 or TypeCode.Int64 => JsonSchemaType.Integer,
            TypeCode.Boolean => JsonSchemaType.Boolean,
            TypeCode.Decimal or TypeCode.Double or TypeCode.Single => JsonSchemaType.Number,
            _ => JsonSchemaType.Object
        };
    }

    private static JsonSchemaType GetJsonSchemaType(PropertyInfo propertyInfo)
    {
        var type = propertyInfo.PropertyType;
        var underlyingType = Nullable.GetUnderlyingType(type);
        var targetType = underlyingType ?? type;
        var nullability = new NullabilityInfoContext().Create(propertyInfo);
        var result = GetJsonSchemaType(targetType);

        if (targetType.IsArray ||
            (targetType.IsGenericType && targetType.GetGenericTypeDefinition() == typeof(List<>)))
        {
            result = JsonSchemaType.Array;
        }

        if (underlyingType is not null || nullability.ReadState == NullabilityState.Nullable)
        {
            result |= JsonSchemaType.Null;
        }

        return result;
    }

    private static bool IsComplexType(Type type)
    {
        var currentAssembly = Assembly.GetExecutingAssembly();

        if (type.IsGenericType)
        {
            return type.GetGenericArguments().Any(x => x.Assembly == currentAssembly);
        }

        return type.Assembly == currentAssembly;
    }

    private static bool IsGenericType(Type type)
    {
        var result = type.IsGenericType && type.GetGenericTypeDefinition() == typeof(List<>);
        return result;
    }

    private static Dictionary<string, IOpenApiSchema> SortOpenApiSchemaProperties(
        List<ResponseProperty> openApiProperties)
    {
        if (openApiProperties.All(x => x.Order == 0))
        {
            return openApiProperties.OrderBy(x => x.Name)
                .ToDictionary(x => x.Name, x => x.Schema);
        }

        return openApiProperties.OrderBy(x => x.Order)
            .ToDictionary(x => x.Name, x => x.Schema);
    }

    private static List<JsonNode> GetValueNumbersFromEnumType(Type type)
    {
        var result = new List<JsonNode>();

        if (type.IsEnum)
        {
            result = Enum.GetValues(type)
                .OfType<Enum>()
                .Select(name => JsonValue.Create(Convert.ToInt32(name, CultureInfo.InvariantCulture)))
                .Cast<JsonNode>()
                .ToList();
        }

        return result;
    }

    private static List<JsonNode> GetValueNamesFromEnumType(Type type)
    {
        var result = new List<JsonNode>();

        if (type.IsEnum)
        {
            result = Enum.GetNames(type)
                .Select(name => JsonValue.Create(name))
                .Cast<JsonNode>()
                .ToList();
        }

        return result;
    }
}
