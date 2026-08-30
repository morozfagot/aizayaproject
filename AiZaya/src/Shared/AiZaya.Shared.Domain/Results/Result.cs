using AiZaya.Shared.Domain.Results.Interfaces;

namespace AiZaya.Shared.Domain.Results;

public sealed class Result : IResult, IEquatable<Result>
{
    public static Result Success() => new();

    public static Result Failure(Error error) => new(error);

    private readonly Error? _error;

    public Error Error => IsFailure
        ? _error!
        : throw new InvalidOperationException("Свойство Failure недоступно, если ошибок не зарегистрировано. " +
                                              "Перед обращением к свойству Failure проверьте IsFailure");

    public bool IsFailure => _error is not null;

    public bool IsSuccess => !IsFailure;

    private Result()
    {
    }

    private Result(Error error) => _error = error;

    public bool Equals(Result? other)
    {
        if (other is null)
        {
            return false;
        }

        if (IsSuccess && other.IsSuccess)
        {
            return true;
        }

        return false;
    }

    public override bool Equals(object? obj)
    {
        if (obj is null || obj.GetType() != this.GetType())
        {
            return false;
        }

        if (ReferenceEquals(this, obj))
        {
            return true;
        }

        return Equals((Result)obj);
    }

    public override int GetHashCode()
    {
        return IsFailure.GetHashCode();
    }

    public static bool operator ==(Result left, Result right) => left.Equals(right);

    public static bool operator !=(Result left, Result right) => !left.Equals(right);

    public static implicit operator Result(Error error) => new(error);

    public static implicit operator bool(Result result) => result.IsSuccess;
}

public sealed class Result<TValue> : IResult<TValue>, IEquatable<Result<TValue>>
{
    public static Result<TValue> Success(TValue value) => new(value);

    public static Result<TValue> Failure(Error error) => new(error);

    private readonly TValue? _value;

    private readonly Error? _error;

    public Error Error => IsFailure
        ? _error!
        : throw new InvalidOperationException("Свойство Failure недоступно, если ошибок не зарегистрировано. " +
                                              "Перед обращением к свойству Failure проверьте IsFailure");

    public bool IsFailure => _error is not null;

    public bool IsSuccess => !IsFailure;

    public TValue Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("Свойство Value не может быть доступно при наличии ошибок. " +
                                              "Проверьте IsFailure перед доступом к Value.");

    private Result()
    {
        throw new InvalidOperationException(
            "Используйте конструкторы с параметрами для создания экземпляра Result");
    }

    private Result(Error error) => _error = error;

    private Result(TValue value)
    {
        if (value is not null)
        {
            _value = value;
        }
        else
        {
            throw new ArgumentNullException(nameof(value));
        }
    }

    public bool Equals(Result<TValue>? other)
    {
        if (other is null)
        {
            return false;
        }

        if (other.IsSuccess && IsSuccess)
        {
            return Value?.Equals(other.Value) ?? false;
        }

        return false;
    }

    public override bool Equals(object? obj)
    {
        if (obj is null || obj.GetType() != this.GetType())
        {
            return false;
        }

        if (ReferenceEquals(this, obj))
        {
            return true;
        }

        return Equals((Result<TValue>)obj);
    }

    public override int GetHashCode()
    {
        return Value?.GetHashCode() ?? IsFailure.GetHashCode();
    }

    public static bool operator ==(Result<TValue> left, Result<TValue> right) => left.Equals(right);

    public static bool operator !=(Result<TValue> left, Result<TValue> right) => !left.Equals(right);

    public static implicit operator Result<TValue>(TValue value) => new(value);

    public static implicit operator Result<TValue>(Error error) => new(error);

    public static implicit operator bool(Result<TValue> result) => result.IsSuccess;
}
