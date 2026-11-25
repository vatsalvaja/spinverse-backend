import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../../common/utils/normalize.util';
import { RELEASE_NOTES_MAX_LENGTH } from '../constants/game-packages.constants';

/** Text fields sent next to the ZIP in the multipart upload. */
export class UploadVersionDto {
  @ApiPropertyOptional({ maxLength: RELEASE_NOTES_MAX_LENGTH, example: 'Fixes the bonus round animation' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(RELEASE_NOTES_MAX_LENGTH)
  releaseNotes?: string;
}
