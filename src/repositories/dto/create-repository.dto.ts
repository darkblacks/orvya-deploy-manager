import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  name: string;

  @IsUrl({ require_tld: false })
  githubUrl: string;

  @IsOptional()
  @IsString()
  branch?: string = 'main';

  @IsString()
  localPath: string;

  @IsString()
  pm2Name: string;

  @IsString()
  healthUrl: string;

  @IsOptional()
  @IsString()
  installCommand?: string = 'npm ci';

  @IsOptional()
  @IsString()
  buildCommand?: string = 'npm run build';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}
