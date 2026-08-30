using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Infrastructure.Serialization;
using System.Text.Json;
using Xunit;

namespace AiZaya.Shared.Infrastructure.UnitTest;

public class DomainEventJsonConverterTests
{
    public record TestDomainEvent(string Payload) : DomainEvent;

    private static JsonSerializerOptions CreateOptions(DomainEventJsonConverter converter) =>
        new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { converter }
        };

    [Fact]
    public void Write_ShouldSerializeWithTypeDiscriminator()
    {
        var assembly = typeof(TestDomainEvent).Assembly;
        var converter = new DomainEventJsonConverter(assembly);
        var options = CreateOptions(converter);
        var evt = new TestDomainEvent("hello");

        var json = JsonSerializer.Serialize<IDomainEvent>(evt, options);

        Assert.Contains("\"$type\"", json);
        Assert.Contains("\"payload\"", json);
        Assert.Contains("hello", json);
    }

    [Fact]
    public void RoundTrip_ShouldPreservePayload()
    {
        var assembly = typeof(TestDomainEvent).Assembly;
        var converter = new DomainEventJsonConverter(assembly);
        var options = CreateOptions(converter);

        var original = new TestDomainEvent("data");
        var json = JsonSerializer.Serialize<IDomainEvent>(original, options);
        var deserialized = JsonSerializer.Deserialize<IDomainEvent>(json, options);

        Assert.NotNull(deserialized);
        var typed = Assert.IsType<TestDomainEvent>(deserialized);
        Assert.Equal("data", typed.Payload);
    }

    [Fact]
    public void Read_WithoutTypeProperty_ShouldThrow()
    {
        var assembly = typeof(TestDomainEvent).Assembly;
        var converter = new DomainEventJsonConverter(assembly);
        var options = CreateOptions(converter);

        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<IDomainEvent>("{\"payload\":\"x\"}", options));
    }
}
