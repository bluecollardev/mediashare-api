import { Controller, Get, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticationGuard } from '@nestjs-cognito/auth';
import { Response } from 'express';
import {
  handleErrorResponse,
  handleSuccessResponse,
} from '@mediashare/core/http/response';
import { MediaItemService } from '../media-item/media-item.service';
import { PlaylistItemService } from '../playlist-item/playlist-item.service';
import { AdminGuard } from './admin.guard';

/**
 * Admin-only moderation surface. Today it just exposes the reported
 * content roster (media items + playlist items with reportedCount > 0)
 * with reporter info joined from the user collection.
 */
@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly mediaItemService: MediaItemService,
    private readonly playlistItemService: PlaylistItemService
  ) {}

  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @Get('/reports')
  async listReports(@Res() res: Response) {
    try {
      const pipeline = [
        { $match: { reportedCount: { $gt: 0 } } },
        {
          $lookup: {
            from: 'user',
            localField: 'reports.reporterSub',
            foreignField: 'sub',
            as: 'reporters',
          },
        },
        // Also resolve the uploader so the UI can show name/email
        // and the admin can suspend the user from this row.
        {
          $lookup: {
            from: 'user',
            localField: 'createdBy',
            foreignField: 'sub',
            as: 'uploaderArr',
          },
        },
        {
          $addFields: {
            uploader: { $arrayElemAt: ['$uploaderArr', 0] },
          },
        },
        { $project: { uploaderArr: 0 } },
      ];

      const [mediaRows, playlistRows] = await Promise.all([
        this.mediaItemService.dataService.repository
          .aggregate(pipeline)
          .toArray(),
        this.playlistItemService.dataService.repository
          .aggregate(pipeline)
          .toArray(),
      ]);

      const rows = [
        ...mediaRows.map((r: any) => ({ ...r, contentType: 'mediaItem' })),
        ...playlistRows.map((r: any) => ({
          ...r,
          contentType: 'playlistItem',
        })),
      ].sort(
        (a: any, b: any) => (b.reportedCount || 0) - (a.reportedCount || 0)
      );

      // The rxjs ajax client throws on 304; keep responses fresh.
      res.setHeader('Cache-Control', 'no-store');
      return handleSuccessResponse(res, HttpStatus.OK, rows);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  /**
   * Aggregate report activity per reporter — used by the
   * "Reports by User" page to spot a single account flagging lots
   * of content (likely harassment / abuse-of-flag).
   */
  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @Get('/reports-by-user')
  async listReportsByUser(@Res() res: Response) {
    try {
      // Unwind each item's `reports` array, group by reporterSub,
      // and project the item back onto each row so the UI can show
      // which items were reported.
      const buildPipeline = (contentType: 'mediaItem' | 'playlistItem') => [
        { $match: { reportedCount: { $gt: 0 } } },
        { $unwind: '$reports' },
        {
          $project: {
            reporterSub: '$reports.reporterSub',
            entry: {
              itemId: '$_id',
              title: '$title',
              imageSrc: '$imageSrc',
              uri: '$uri',
              contentType,
              uploaderSub: '$createdBy',
              isSuspended: '$isSuspended',
              reason: '$reports.reason',
              comment: '$reports.comment',
              reportedAt: '$reports.reportedAt',
            },
          },
        },
      ];

      const [mediaEntries, playlistEntries] = await Promise.all([
        this.mediaItemService.dataService.repository
          .aggregate(buildPipeline('mediaItem'))
          .toArray(),
        this.playlistItemService.dataService.repository
          .aggregate(buildPipeline('playlistItem'))
          .toArray(),
      ]);

      const grouped: Record<string, any> = {};
      const combined: any[] = [
        ...(mediaEntries as any[]),
        ...(playlistEntries as any[]),
      ];
      for (const row of combined) {
        const sub = row?.reporterSub || 'anonymous';
        if (!grouped[sub]) {
          grouped[sub] = { reporterSub: sub, reportCount: 0, reports: [] };
        }
        grouped[sub].reportCount += 1;
        grouped[sub].reports.push(row.entry);
      }

      // Stitch user records onto each group AND each entry via a
      // single cross-collection lookup. mongoose/typeorm repos here
      // are tied to a specific entity, so we reach down to the raw
      // mongo client to query the `user` collection in the same db.
      const reporterSubs = Object.keys(grouped).filter(
        (s) => s !== 'anonymous'
      );
      const uploaderSubs = Array.from(
        new Set(
          Object.values(grouped).flatMap((g: any) =>
            (g.reports || [])
              .map((r: any) => r?.uploaderSub)
              .filter((s: string) => !!s)
          )
        )
      );
      const allSubs = Array.from(new Set([...reporterSubs, ...uploaderSubs]));
      if (allSubs.length > 0) {
        const db = (
          this.mediaItemService.dataService.repository as any
        ).manager.mongoQueryRunner.databaseConnection.db('mediashare');
        const users = await db
          .collection('user')
          .find({ sub: { $in: allSubs } })
          .toArray();
        const usersBySub = new Map<string, any>(
          users.map((u: any) => [u.sub, u])
        );
        // Stitch reporter info onto each group.
        for (const sub of reporterSubs) {
          grouped[sub].user = usersBySub.get(sub) || null;
        }
        // Stitch uploader display info onto each entry so the UI
        // can render name + email without an extra round-trip.
        for (const g of Object.values(grouped) as any[]) {
          for (const r of g.reports || []) {
            const u = r?.uploaderSub
              ? usersBySub.get(r.uploaderSub) || null
              : null;
            if (u) {
              r.uploader = {
                _id: u._id,
                sub: u.sub,
                email: u.email,
                username: u.username,
                firstName: u.firstName,
                lastName: u.lastName,
                imageSrc: u.imageSrc,
                isDisabled: !!u.isDisabled,
              };
            }
          }
        }
      }

      const rows = Object.values(grouped).sort(
        (a: any, b: any) => b.reportCount - a.reportCount
      );

      res.setHeader('Cache-Control', 'no-store');
      return handleSuccessResponse(res, HttpStatus.OK, rows);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }
}
