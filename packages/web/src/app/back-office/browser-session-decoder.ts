import { BrowserSession } from '@froment/contracts';
import { Schema } from 'effect';

export const decodeBrowserSession = Schema.decodeUnknownSync(BrowserSession);
