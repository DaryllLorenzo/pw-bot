import { Module } from '@nestjs/common';
import V1AssessmentsController from './controllers/v1-assessments.controller';
import AssessmentsService from './services/assessments.service';
import DatabaseModule from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [V1AssessmentsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService]
})
export default class AssessmentsModule {}
