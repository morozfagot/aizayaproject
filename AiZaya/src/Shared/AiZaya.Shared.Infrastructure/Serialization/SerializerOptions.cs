using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;

namespace AiZaya.Shared.Infrastructure.Serialization;

public class SerializerOptions : ISerializerOptions
{
    public JsonSerializerOptions Default { get; }

    public SerializerOptions(DomainEventJsonConverter converter)
    {
        ArgumentNullException.ThrowIfNull(converter);

        Default = new JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            AllowOutOfOrderMetadataProperties = false,
            Converters = { converter }
        };
    }
}
