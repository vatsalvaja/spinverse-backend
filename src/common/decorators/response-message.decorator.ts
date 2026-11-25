import { SetMetadata } from '@nestjs/common';
import { RESPONSE_MESSAGE_KEY } from '../constants/api.constants';

/** Overrides the default `message` in the success envelope for a route. */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);
