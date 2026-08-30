using AiZaya.Shared.Domain.Results;

namespace AiZaya.Shared.Feature.Exceptions;

public sealed class AiZayaException(
    string requestName,
    Error? error = default,
    Exception? innerException = default)
    : Exception("AiZaya exception", innerException)
{
    public string RequestName { get; } = requestName;
    public Error? Error { get; } = error;
}
