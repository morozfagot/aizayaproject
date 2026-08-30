using AiZaya.Shared.Feature.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;
using Xunit;

namespace AiZaya.Shared.Feature.UnitTest;

public class EndpointTests
{
    private sealed class TestEndpoint : IEndpoint
    {
        public static bool MapCalled;
        public void MapEndpoint(IEndpointRouteBuilder endpoint)
        {
            MapCalled = true;
        }
    }

    [Fact]
    public void AddEndpoints_ShouldRegisterEndpointImplementations()
    {
        var services = new ServiceCollection();
        var assembly = typeof(TestEndpoint).Assembly;

        services.AddEndpoints(assembly);

        var provider = services.BuildServiceProvider();
        var endpoints = provider.GetServices<IEndpoint>().ToList();

        Assert.Contains(endpoints, e => e is TestEndpoint);
    }

    [Fact]
    public void AddEndpoints_ShouldRegisterOnlyIEndpointImplementations()
    {
        var services = new ServiceCollection();
        var assembly = typeof(TestEndpoint).Assembly;

        services.AddEndpoints(assembly);

        var provider = services.BuildServiceProvider();
        var allRegistered = provider.GetServices<IEndpoint>().ToList();

        Assert.NotEmpty(allRegistered);
        Assert.All(allRegistered, e => Assert.IsAssignableFrom<IEndpoint>(e));
    }
}
