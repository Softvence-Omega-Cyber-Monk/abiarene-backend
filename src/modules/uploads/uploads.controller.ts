import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AllowWithoutTenant } from '../../common/decorators/allow-without-tenant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UploadsService } from './uploads.service.js';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  @Post('image')
  @AllowWithoutTenant()
  @Roles('admin', 'supervisor')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an image to Cloudinary for admin or supervisor',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 403, description: 'Only admin or supervisor can upload images' })
  uploadImage(@UploadedFile() file: UploadedImageFile) {
    return this.service.uploadImage(file);
  }
}
