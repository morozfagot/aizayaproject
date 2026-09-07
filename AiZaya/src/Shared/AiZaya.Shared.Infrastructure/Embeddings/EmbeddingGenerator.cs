using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AiZaya.Shared.Feature.Embeddings;

namespace AiZaya.Shared.Infrastructure.Embeddings;

/// <summary>
/// Реализация <see cref="IEmbeddingGenerator"/>.
/// Внутри дискриминирует по <see cref="EmbedderProviderConfig.ProviderType"/> через switch.
/// На текущий момент реализован только OpenAI-совместимый протокол — он покрывает
/// OpenAI, OpenRouter, Ollama (в режиме совместимости), vLLM и LM Studio.
/// </summary>
internal sealed class EmbeddingGenerator : IEmbeddingGenerator
{
    public async Task<IReadOnlyDictionary<string, IReadOnlyList<float>>> GenerateAsync(
        EmbedderProviderConfig config,
        IReadOnlyList<string> inputs,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(inputs);

        return config.ProviderType switch
        {
            ProviderType.OpenAiCompatible => await SendOpenAiCompatibleAsync(config, inputs, cancellationToken),
            _ => throw new NotSupportedException(
                $"Provider type '{config.ProviderType}' is not supported."),
        };
    }

    private static async Task<IReadOnlyDictionary<string, IReadOnlyList<float>>> SendOpenAiCompatibleAsync(
        EmbedderProviderConfig config,
        IReadOnlyList<string> inputs,
        CancellationToken cancellationToken)
    {
        var endpoint = BuildEmbeddingsEndpoint(config.BaseUrl);

        using var http = new HttpClient
        {
            Timeout = TimeSpan.FromMilliseconds(config.TimeoutMs),
        };

        var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(new OpenAiEmbeddingRequest
            {
                Model = config.ModelName,
                Input = inputs.ToArray(),
            }),
        };

        if (!string.IsNullOrWhiteSpace(config.ApiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.ApiKey);
        }

        using var response = await http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<OpenAiEmbeddingResponse>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("Empty response body from embeddings API.");

        if (payload.Data is null || payload.Data.Count != inputs.Count)
        {
            throw new InvalidOperationException(
                $"Embeddings API returned {payload.Data?.Count ?? 0} vectors for {inputs.Count} inputs.");
        }

        var result = new Dictionary<string, IReadOnlyList<float>>(inputs.Count, StringComparer.Ordinal);
        for (var i = 0; i < inputs.Count; i++)
        {
            result[inputs[i]] = payload.Data[i].Embedding;
        }

        return result;
    }

    private static string BuildEmbeddingsEndpoint(string baseUrl)
    {
        var trimmed = baseUrl.TrimEnd('/');
        if (trimmed.EndsWith("/embeddings", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        return trimmed + "/embeddings";
    }

    private sealed class OpenAiEmbeddingRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; init; } = string.Empty;

        [JsonPropertyName("input")]
        public string[] Input { get; init; } = Array.Empty<string>();
    }

    private sealed class OpenAiEmbeddingResponse
    {
        [JsonPropertyName("data")]
        public List<OpenAiEmbeddingItem>? Data { get; init; }
    }

    private sealed class OpenAiEmbeddingItem
    {
        [JsonPropertyName("embedding")]
        public float[] Embedding { get; init; } = Array.Empty<float>();
    }
}