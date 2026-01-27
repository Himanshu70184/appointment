/**
 * Utility functions for the frontend application
 */

/**
 * Safely get appointment type name from either string or populated object
 * @param appointmentType - Can be string ID or populated object
 * @returns The appointment type name or fallback text
 */
export function getAppointmentTypeName(
  appointmentType: string | { name: string; [key: string]: any } | undefined
): string {
  if (!appointmentType) return 'N/A';
  
  if (typeof appointmentType === 'string') {
    return appointmentType;
  }
  
  return appointmentType.name || 'N/A';
}

/**
 * Safely get appointment type duration from populated object
 * @param appointmentType - Populated appointment type object
 * @returns Duration in minutes or null
 */
export function getAppointmentTypeDuration(
  appointmentType: string | { duration: number; [key: string]: any } | undefined
): number | null {
  if (!appointmentType || typeof appointmentType === 'string') {
    return null;
  }
  
  return appointmentType.duration || null;
}

/**
 * Safely get appointment type price from populated object
 * @param appointmentType - Populated appointment type object
 * @returns Price or 0
 */
export function getAppointmentTypePrice(
  appointmentType: string | { price: number; [key: string]: any } | undefined
): number {
  if (!appointmentType || typeof appointmentType === 'string') {
    return 0;
  }
  
  return appointmentType.price || 0;
}

/**
 * Format date to readable string
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatDate(date: string | Date | undefined): string {
  if (!date) return 'N/A';
  
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Format time to 12-hour format
 * @param time - Time string in HH:MM format
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(time: string | undefined): string {
  if (!time) return 'N/A';
  
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    return time;
  }
}

/**
 * Get status badge color classes
 * @param status - Appointment status
 * @returns Tailwind CSS classes for badge
 */
export function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    scheduled: 'bg-green-100 text-green-800',
    approval: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-orange-100 text-orange-800',
    'on-hold': 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-gray-100 text-gray-800',
    rescheduled: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Format currency amount
 * @param amount - Amount in dollars
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '$0.00';
  return `$${amount.toFixed(2)}`;
}

/**
 * Truncate text to specified length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis
 */
export function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
