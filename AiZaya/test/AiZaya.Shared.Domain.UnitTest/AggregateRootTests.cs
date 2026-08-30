using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Abstractions.Interfaces;
using AiZaya.Shared.Domain.Results;
using Xunit;

namespace AiZaya.Shared.Domain.UnitTest;

public class AggregateRootTests
{
    private sealed record TestDomainEvent(string Payload) : DomainEvent;

    private sealed class TestId : IValueObject
    {
        public Guid Value { get; init; }

        public TestId(Guid value) => Value = value;
    }

    private sealed class TestAggregate : AggregateRoot<TestId>
    {
        public void DoSomething()
        {
            Raise(new TestDomainEvent("hello"));
        }
    }

    [Fact]
    public void NewAggregate_ShouldHaveNoDomainEvents()
    {
        var agg = new TestAggregate();

        Assert.Empty(agg.DomainEvents);
    }

    [Fact]
    public void Raise_ShouldAddDomainEvent()
    {
        var agg = new TestAggregate();
        agg.DoSomething();

        Assert.Single(agg.DomainEvents);
    }

    [Fact]
    public void PopDomainEvents_ShouldReturnAllAndClear()
    {
        var agg = new TestAggregate();
        agg.DoSomething();
        agg.DoSomething();

        var events = agg.PopDomainEvents();

        Assert.Equal(2, events.Count);
        Assert.Empty(agg.DomainEvents);
    }

    [Fact]
    public void DomainEvent_ShouldHaveUniqueIdAndOccurredOn()
    {
        var e1 = new TestDomainEvent("a");
        var e2 = new TestDomainEvent("b");

        Assert.NotEqual(e1.Id, e2.Id);
        Assert.NotEqual(default, e1.OccurredOnUtc);
    }
}

public class EntityTests
{
    private sealed class TestEntityId : IValueObject;

    private sealed class TestEntity : Entity<TestEntityId>;

    [Fact]
    public void Entity_ShouldExposeId()
    {
        var id = new TestEntityId();
        var entity = new TestEntity();

        Assert.Null(entity.Id);
    }
}

public class AggregateRootConcurrencyTests
{
    private sealed class TestId : IValueObject;

    private sealed class TestAggregateWithRowVersion : AggregateRootConcurrency<TestId, Guid>
    {
        public void SetRowVersion(Guid v) => RowVersion = v;
    }

    [Fact]
    public void RowVersion_DefaultIsDefault()
    {
        var agg = new TestAggregateWithRowVersion();

        Assert.Equal(default, agg.RowVersion);
    }

    [Fact]
    public void RowVersion_CanBeSet()
    {
        var agg = new TestAggregateWithRowVersion();
        var version = Guid.NewGuid();

        agg.SetRowVersion(version);

        Assert.Equal(version, agg.RowVersion);
    }
}
