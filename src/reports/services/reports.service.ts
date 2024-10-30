import { Injectable, Logger } from '@nestjs/common';
import PgService from '../../database/services/pg.service';
import * as ExcelJS from 'exceljs';
import RankingTableOutDto, {
  RankingRow,
} from '../dto/out/ranking-table.out.dto';
import StudentsService from '../../students/services/students.service';
import GradesService from '../../grades/services/grades.service';
import GradesTableOutDto, { GradeRow } from '../dto/out/grades-table.out.dto';
import AssessmentsService from '../../assessments/services/assessments.service';
import UserWithStudentOutDto from '../../users/dto/out/user-with-student.out.dto';

@Injectable()
export default class ReportsService {
  constructor(
    private readonly pgService: PgService,
    private readonly gradesService: GradesService,
    private readonly studentService: StudentsService,
    private readonly assessmentService: AssessmentsService,
  ) {}

  private readonly logger = new Logger(ReportsService.name);
  private readonly PROFESSOR_USERNAME: string = 'eduardoProfe666';

  public async getRankingTable(): Promise<RankingTableOutDto> {
    const students = await this.studentService.getAll();
    const rankingMap = new Map<
      number,
      { studentId: number; average: number }
    >();

    for (const student of students.filter(
      (x) => x.username !== this.PROFESSOR_USERNAME && !x.isRecognized,
    )) {
      const average = await this.gradesService.getAvgByStudentId(student.id);

      rankingMap.set(student.id, { studentId: student.id, average });
    }

    const rankingArray = Array.from(rankingMap.values()).sort((a, b) => {
      if (a.average === 0 && b.average === 0) return 0;
      if (a.average === 0) return 1;
      if (b.average === 0) return -1;
      return b.average - a.average;
    });

    const rankingRows: RankingRow[] = [];

    let pos = 0;
    let prevAvg = -1;

    for (const { studentId, average } of rankingArray) {
      if (average !== prevAvg) {
        pos += 1;
        prevAvg = average;
      }
      rankingRows.push({ studentId: studentId, avg: average, position: pos });
    }

    return {
      ranking: rankingRows,
    };
  }

  public async getGradesTable(username: string): Promise<GradesTableOutDto> {
    const grades = await this.gradesService.getByStudentUsername(username);
    const student = await this.studentService.getByUsername(username);

    const gradeRows: GradeRow[] = [];

    for (const grade of grades) {
      gradeRows.push({
        grade: grade.grade,
        gradeId: grade.id,
        assessmentId: grade.assessment.id,
        assessmentName: grade.assessment.name,
      });
    }

    return {
      gradeTable: gradeRows,
      studentId: student.id,
      avg: await this.gradesService.getAvgByStudentUsername(username),
    };
  }

  public async exportRankingTable() {}

  public async exportStudentList() {
    const users = await this.pgService.users.find({ relations: ['student'] });

    const userDtos: UserWithStudentOutDto[] = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      student: user.student,
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lista de Estudiantes del G-31');

    worksheet.columns = [
      { header: 'No. de lista', key: 'listNumber', width: 25 },
      { header: 'Nombre Completo', key: 'fullName', width: 35 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Nombre de Usuario', key: 'username', width: 25 },
      { header: 'Nombre Acortado', key: 'shortName', width: 25 },
      { header: 'Convalidado', key: 'recognized', width: 18 },
      { header: 'Promedio', key: 'average', width: 18 },
    ];

    let totalAverage = 0;
    let studentCount = userDtos.length;

    for (const user of userDtos) {
      const average = await this.gradesService.getAvgByStudentUsername(user.username);
      totalAverage += average;

      const row = worksheet.addRow({
        listNumber: user.student.listNumber,
        fullName: user.student.fullName,
        email: user.email,
        username: user.username,
        shortName: user.student.name,
        recognized: user.student.isRecognized ? 'Sí' : 'No',
        average: average > 0 ? average.toFixed(2) : '---',
      });

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }

    const averageOfAverages = studentCount > 0 && totalAverage > 0 ? (totalAverage / studentCount).toFixed(2) : '---';

    worksheet.addRow([]);

    const aggregationRow = worksheet.addRow([
      'Total de Estudiantes: ',
      studentCount,
      '',
      `Promedio de Promedios: `,
      averageOfAverages,
    ]);

    aggregationRow.eachCell(( cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.fill = {
        type: 'pattern',
        pattern:'solid',
        fgColor:{argb:'FFDDDDDD'}
      };
    });

    worksheet.getRow(1).eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    worksheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: worksheet.rowCount,
        column: worksheet.columnCount,
      },
    };

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).alignment = { horizontal: 'center' };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { horizontal: 'center' };
    });

    worksheet.columns.forEach((column) => {
      const maxLength = column.values
        .filter(value => typeof value === 'string' || typeof value === 'number')
        .reduce((max, value) => Math.max(max as number, value.toString().length), 0);

      column.width = maxLength as number + 8;
    });

    workbook.creator = 'EduardoProfe666';

    return await workbook.xlsx.writeBuffer();
  }

  public async exportGradesTable(username: string) {}
}
