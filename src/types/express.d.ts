import type { TokenPayload } from 'src/modules/auth/auth.service';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends TokenPayload {}
  }
}
