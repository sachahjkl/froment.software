import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

export class BlogApi extends HttpApiGroup.make('blog', { topLevel: true }).add(
  HttpApiEndpoint.get('blogFeed', '/api/blog/feed', {
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'application/atom+xml' })),
  }),
) {}
