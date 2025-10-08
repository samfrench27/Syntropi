// apps/api/src/services/activity.service.ts
import { Activity, IActivity } from '../models/activity.model';
import { winstonLogger as logger } from '../utils/logger';

// Get analytics data from activities
export const getAnalyticsData = async (filter: any, startDate: Date, endDate: Date) => {
  try {
    // Always filter by createdAt for real-time analytics
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    const matchFilter = { ...filter, ...dateFilter };
    // Get daily activity counts
    const dailyStats = await Activity.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          actions: {
            $push: '$action'
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get action breakdown
    const actionBreakdown = await Activity.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      dailyStats,
      actionBreakdown
    };

  } catch (error: any) {
    logger.error('Error getting analytics data:', error);
    throw error;
  }
};

// Get activities with pagination
export const getActivities = async (filter: any, limit: number, offset: number) => {
  try {
    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .populate('user', 'name email')
        .populate('organization', 'name')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset),
      Activity.countDocuments(filter)
    ]);

    return { activities, total };

  } catch (error: any) {
    logger.error('Error getting activities:', error);
    throw error;
  }
};

// Create activity log
export const createActivity = async (activityData: Partial<IActivity>) => {
  try {
    const activity = new Activity(activityData);
    await activity.save();
    return activity;
  } catch (error: any) {
    logger.error('Error creating activity:', error);
    throw error;
  }
};
