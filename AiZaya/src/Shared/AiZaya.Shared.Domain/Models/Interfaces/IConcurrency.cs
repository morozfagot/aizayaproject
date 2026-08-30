namespace AiZaya.Shared.Domain.Abstractions.Interfaces;

public interface IConcurrency<out TRowVersion> where TRowVersion : notnull
{
    TRowVersion RowVersion { get; }
}
