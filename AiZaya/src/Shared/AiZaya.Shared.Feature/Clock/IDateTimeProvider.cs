namespace AiZaya.Shared.Feature.Clock;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}
