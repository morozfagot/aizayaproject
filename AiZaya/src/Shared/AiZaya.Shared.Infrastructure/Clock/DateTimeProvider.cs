using AiZaya.Shared.Feature.Clock;

namespace AiZaya.Shared.Infrastructure.Clock;

internal sealed class DateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
