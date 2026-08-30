using System.Text.Json;

namespace AiZaya.Shared.Infrastructure.Serialization;

public interface ISerializerOptions
{
    JsonSerializerOptions Default { get; }
}
