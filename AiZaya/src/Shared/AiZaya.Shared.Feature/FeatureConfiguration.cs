using AiZaya.Shared.Feature.Behaviors;
using AiZaya.Shared.Feature.Exceptions;
using AiZaya.Shared.Feature.OpenApi.Extensions;
using AiZaya.Shared.Feature.OpenApi.Parsers;
using AiZaya.Shared.Feature.OpenApi.Transformers;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace AiZaya.Shared.Feature;

public static class FeatureConfiguration
{
    public static IServiceCollection AddFeature(
        this IServiceCollection services,
        Assembly[] moduleAssemblies, string mediatRLicenseKey,
        ModelPatternName modelPatternName, ResponsePatternName responsePatternName)
    {
        services.AddExceptionHandler<AiZayaExceptionHandler>();
        services.AddProblemDetails();

        services.AddMediatR(config =>
        {
            config.LicenseKey = mediatRLicenseKey;

            config.RegisterServicesFromAssemblies(moduleAssemblies);

            config.AddOpenBehavior(typeof(ExceptionPipelineBehavior<,>));
            config.AddOpenBehavior(typeof(RulePipelineBehavior<,>));
        });

        services.AddValidatorsFromAssemblies(moduleAssemblies, includeInternalTypes: true);

        services.AddOpenApi(options =>
        {
            options.CreateModels(modelPatternName);
            options.CreateResponses(responsePatternName);
        });

        return services;
    }
}
