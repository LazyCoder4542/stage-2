import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GithubCallbackResponse {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_cli?: boolean = false;
}

export class GithubAuthQuery {
  @IsString()
  code: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_cli?: boolean = false;

  @IsOptional()
  @IsString()
  code_verifier?: string;
}
