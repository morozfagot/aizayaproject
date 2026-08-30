namespace AiZaya.Shared.Domain.Results.Interfaces;

public interface IResult
{
    Error Error { get; }

    bool IsFailure { get; }

    bool IsSuccess { get; }
}

public interface IResult<out TValue> : IResult
{
    TValue Value { get; }
}
