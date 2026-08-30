using AiZaya.Shared.Feature.Clock;
using Xunit;

namespace AiZaya.Shared.Feature.UnitTest;

public class DateTimeProviderContractTests
{
    private sealed class FixedDateTimeProvider : IDateTimeProvider
    {
        public DateTime UtcNow { get; }
        public FixedDateTimeProvider(DateTime utcNow) => UtcNow = utcNow;
    }

    [Fact]
    public void IDateTimeProvider_Contract_ShouldExposeUtcNow()
    {
        IDateTimeProvider provider = new FixedDateTimeProvider(new DateTime(2026, 8, 28, 12, 0, 0, DateTimeKind.Utc));

        Assert.Equal(new DateTime(2026, 8, 28, 12, 0, 0, DateTimeKind.Utc), provider.UtcNow);
    }
}
