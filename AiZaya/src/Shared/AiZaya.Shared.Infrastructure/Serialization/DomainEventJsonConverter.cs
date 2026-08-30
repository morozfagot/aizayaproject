using AiZaya.Shared.Domain.Abstractions.Interfaces;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AiZaya.Shared.Infrastructure.Serialization;

public class DomainEventJsonConverter : JsonConverter<IDomainEvent>
{
    private readonly IReadOnlyCollection<Type> _domainEventTypes;

    private static readonly JsonSerializerOptions _options = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public DomainEventJsonConverter(Assembly assemblyDomainEvent)
    {
        _domainEventTypes = assemblyDomainEvent
            .GetTypes()
            .Where(type => typeof(IDomainEvent).IsAssignableFrom(type) && type is { IsInterface: false, IsAbstract: false })
            .ToArray();
    }

    public override IDomainEvent Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var jsonDocument = JsonDocument.ParseValue(ref reader);
        var root = jsonDocument.RootElement;

        if (!root.TryGetProperty("$type", out var typeElement))
        {
            throw new JsonException("Отсутствует свойство $type");
        }

        var typeValue = typeElement.GetString() ?? string.Empty;
        var targetType = _domainEventTypes.FirstOrDefault(x => x.AssemblyQualifiedName == typeValue);

        if (targetType is null)
        {
            throw new JsonException($"Неизвестный тип: {typeValue}");
        }

        var json = root.GetRawText();

        if (JsonSerializer.Deserialize(json, targetType, options) is not IDomainEvent result)
        {
            throw new JsonException($"Ошибка десериализации {typeValue} как IDomainEvent");
        }

        return result;
    }

    public override void Write(Utf8JsonWriter writer, IDomainEvent value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();

        var currentType = value.GetType();

        var targetType = _domainEventTypes.FirstOrDefault(x => x.AssemblyQualifiedName == currentType.AssemblyQualifiedName);

        if (targetType is null)
        {
            throw new JsonException($"Неизвестный тип: {currentType}");
        }

        writer.WriteString("$type", targetType.AssemblyQualifiedName);

        var properties = targetType.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.CanRead && p.GetIndexParameters().Length == 0)
            .OrderBy(p => p.Name);

        foreach (var prop in properties)
        {
            var propValue = prop.GetValue(value);


            var jsonName = prop.GetCustomAttribute<JsonPropertyNameAttribute>()?.Name ??
                           JsonNamingPolicy.CamelCase.ConvertName(prop.Name);

            writer.WritePropertyName(jsonName);
            JsonSerializer.Serialize(writer, propValue, prop.PropertyType, _options);
        }

        writer.WriteEndObject();
    }
}
