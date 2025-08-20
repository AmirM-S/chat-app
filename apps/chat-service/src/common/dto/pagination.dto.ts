import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';

export class PaginationDto {
  @Type(() => Number)
  @IsOptional()
  @IsPositive()
  @Min(1)
  page?: number = 1;

  
  @Type(() => Number)
  @IsOptional()
  @IsPositive()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}