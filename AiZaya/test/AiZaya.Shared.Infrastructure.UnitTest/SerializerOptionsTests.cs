using AiZaya.Shared.Infrastructure.Serialization;
using Xunit;

namespace AiZaya.Shared.Infrastructure.UnitTest;

public class SerializerOptionsTests
{
    [Fact]
    public void Default_ShouldHaveCamelCaseAndConverter()
    {
        var assembly = typeof(SerializerOptions).Assembly;
        var converter = new DomainEventJsonConverter(assembly);
        var options = new SerializerOptions(converter);

        Assert.NotNull(options.Default);
        Assert.Equal(System.Text.Json.JsonNamingPolicy.CamelCase, options.Default.PropertyNamingPolicy);
        Assert.Contains(converter, options.Default.Converters);
    }

    [Fact]
    public void Constructor_WithNullConverter_ShouldThrow()
    {
        Assert.Throws<ArgumentNullException>(() => new SerializerOptions(null!));
    }
}
