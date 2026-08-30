using AiZaya.Shared.Domain.Abstractions;
using Xunit;

namespace AiZaya.Shared.Domain.UnitTest;

public class ValueObjectTests
{
    private sealed class Money : ValueObject
    {
        public decimal Amount { get; }
        public string Currency { get; }

        public Money(decimal amount, string currency)
        {
            Amount = amount;
            Currency = currency;
        }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Amount;
            yield return Currency;
        }
    }

    [Fact]
    public void Equals_SameValues_ShouldBeEqual()
    {
        var a = new Money(10m, "USD");
        var b = new Money(10m, "USD");

        Assert.Equal(a, b);
        Assert.True(a == b);
        Assert.False(a != b);
    }

    [Fact]
    public void Equals_DifferentValues_ShouldNotBeEqual()
    {
        var a = new Money(10m, "USD");
        var b = new Money(20m, "USD");

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Equals_Null_ShouldNotBeEqual()
    {
        Money? a = null;
        Money? b = null;

        Assert.True(a == b);
    }

    [Fact]
    public void GetHashCode_SameValues_ShouldBeEqual()
    {
        var a = new Money(10m, "USD");
        var b = new Money(10m, "USD");

        Assert.Equal(a.GetHashCode(), b.GetHashCode());
    }

    [Fact]
    public void DifferentType_ShouldNotBeEqual()
    {
        var money = new Money(10m, "USD");
        var other = "money";

        Assert.False(money.Equals(other));
    }
}
