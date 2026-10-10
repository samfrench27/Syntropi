import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { createError } from './errorHandler';

// Handle validation errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(createError('Validation failed', 400));
  }
  next();
};

// Login validation
export const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

// Reset password validation
export const validateResetPassword = [
  body('token').notEmpty().withMessage('Token is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  handleValidationErrors,
];

export const validateCreateAdmin = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    handleValidationErrors,
  ];
  
  // Create organization validation
  export const validateCreateOrganization = [
    body('name').notEmpty().withMessage('Organization name is required'),
    body('contactEmail').isEmail().withMessage('Valid contact email is required'),
    body('plan')
      .isIn(['free', 'starter', 'growth', 'enterprise'])
      .withMessage('Valid plan is required'),
    handleValidationErrors,
  ];
  
  // Update organization validation
  export const validateUpdateOrganization = [
    body('name').optional(),
    body('contactEmail').optional().isEmail().withMessage('Valid contact email is required'),
    body('billingEmail').optional().isEmail().withMessage('Valid billing email is required'),
    body('plan')
      .optional()
      .isIn(['free', 'starter', 'growth', 'enterprise'])
      .withMessage('Valid plan is required'),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'suspended'])
      .withMessage('Valid status is required'),
    handleValidationErrors,
  ];
  
  // Create user validation
  export const validateCreateUser = [
    body('email').isEmail().withMessage('Valid email is required'),
    // Optional: without a password the new user is emailed an invite to set their own
    body('password')
      .optional({ values: 'falsy' })
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('role')
      .isIn(['admin', 'user'])
      .withMessage('Valid role is required'),
    body('organizationId').notEmpty().withMessage('Organization ID is required'),
    handleValidationErrors,
  ];
  
  export const validateUpdateUser = [
    body('firstName').optional(),
    body('lastName').optional(),
    body('role')
      .optional()
      .isIn(['admin', 'user'])
      .withMessage('Valid role is required'),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'suspended'])
      .withMessage('Valid status is required'),
    handleValidationErrors,
  ];
  
// API Key validation
export const validateCreateApiKey = [
  body('name').notEmpty().withMessage('Name is required'),
  body('environment')
    .optional()
    .isIn(['sandbox', 'production'])
    .withMessage('Valid environment is required'),
  handleValidationErrors,
];

// Password update validation
export const validateUpdatePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long'),
  handleValidationErrors,
];

// Client organization update validation
export const validateUpdateClientOrganization = [
  body('contactEmail').optional().isEmail().withMessage('Valid contact email is required'),
  body('billingEmail').optional().isEmail().withMessage('Valid billing email is required'),
  body('settings.webhookUrl').optional().isURL().withMessage('Valid webhook URL is required'),
  handleValidationErrors,
];

// Public signup validation. The password rule matches the Supabase project's password policy.
export const validateSignup = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password needs a lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password needs an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password needs a number'),
  body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }),
  body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }),
  body('companyName').trim().notEmpty().withMessage('Company name is required').isLength({ max: 200 }),
  handleValidationErrors,
];
