import type { TokenPayload } from 'src/modules/auth/auth.service';

declare global {
  namespace Express {
    interface User extends TokenPayload {}
  }
}
