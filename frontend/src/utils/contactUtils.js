import { call } from 'frappe-ui';

/**
 * Finds the first contact matching the given email address.
 * @param {string} email - The email address to search for.
 * @returns {Promise<string|null>} - The name of the contact if found, otherwise null.
 */
export async function findContactByEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  try {
    // Assuming 'email_id' is the primary field storing the unique email in Contact doctype.
    // Based on previous error message, this seems correct.
    const existingContacts = await call('frappe.client.get_list', {
      doctype: 'Contact',
      filters: {
        email_id: email.trim(), // Use primary email field for filtering
      },
      fields: ['name'], // We only need the name
      limit: 1, // We only need to know if at least one exists
    });

    return existingContacts.length > 0 ? existingContacts[0].name : null;

  } catch (error) {
    console.error('Error finding contact by email:', error);
    // Optionally show a non-blocking error message
    // errorMessage(__('Failed to check for existing contact'));
    return null; // Return null on error to avoid blocking the UI flow
  }
} 