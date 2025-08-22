import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class SearchDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  query: string;

  
  @IsString()
  @IsOptional()
  chatId?: string;
}
