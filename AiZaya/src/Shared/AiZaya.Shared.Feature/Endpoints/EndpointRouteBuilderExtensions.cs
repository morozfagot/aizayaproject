using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.Diagnostics.CodeAnalysis;

namespace AiZaya.Shared.Feature.Endpoints;

public static class EndpointRouteBuilderExtensions
{
    private const string Route = nameof(Route);

    extension(IEndpointRouteBuilder builder)
    {
        public RouteHandlerBuilder Get<T>([StringSyntax(Route)] string pattern,
            string summary,
            string description,
            string[] tags,
            Delegate handler) => builder
            .MapGet(pattern, handler)
            .Metadata(summary, description, tags)
            .Produces<T>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status500InternalServerError);

        public RouteHandlerBuilder Post<T>([StringSyntax(Route)] string pattern,
            string summary,
            string description,
            string[] tags,
            Delegate handler) => builder
            .MapPost(pattern, handler)
            .Metadata(summary, description, tags)
            .Produces<T>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status422UnprocessableEntity)
            .Produces(StatusCodes.Status500InternalServerError);

        public RouteHandlerBuilder PostWithConflict<T>([StringSyntax(Route)] string pattern,
            string summary,
            string description,
            string[] tags,
            Delegate handler) => builder
            .Post<T>(pattern, summary, description, tags, handler)
            .Produces(StatusCodes.Status409Conflict);

        public RouteHandlerBuilder Put([StringSyntax(Route)] string pattern,
            string summary,
            string description,
            string[] tags,
            Delegate handler) => builder
            .MapPut(pattern, handler)
            .Metadata(summary, description, tags)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status422UnprocessableEntity)
            .Produces(StatusCodes.Status500InternalServerError);

        public RouteHandlerBuilder PutWithConflict([StringSyntax(Route)] string pattern,
            string summary,
            string description,
            string[] tags,
            Delegate handler) => builder
            .Put(pattern, summary, description, tags, handler)
            .Produces(StatusCodes.Status409Conflict);

        public RouteHandlerBuilder Delete([StringSyntax(Route)] string pattern,
            string summary,
            string description,
            string[] tags,
            Delegate handler) => builder
            .MapDelete(pattern, handler)
            .Metadata(summary, description, tags)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status422UnprocessableEntity)
            .Produces(StatusCodes.Status500InternalServerError);

        public RouteHandlerBuilder DeleteWithConflict(string pattern,
            string summary,
            string description,
            string[] tags,
            Delegate handler) => builder
            .Delete(pattern, summary, description, tags, handler)
            .Produces(StatusCodes.Status409Conflict);
    }

    private static RouteHandlerBuilder Metadata(this RouteHandlerBuilder builder,
        string? summary,
        string? description,
        params string[] tags)
    {
        if (summary is not null)
        {
            builder.WithSummary(summary);
        }

        if (description is not null)
        {
            builder.WithDescription(description);
        }

        builder.WithTags(tags);

        return builder;
    }
}
