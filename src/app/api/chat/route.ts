import { NextResponse } from 'next/server';
import { createClient as createServerClientInstance } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendAdminAlertEmail } from '@/lib/email';

const ADMIN_LIST = (process.env.ADMIN_EMAILS || 'admin@yourdomain.com,jane.doe@example.com').split(',');

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get('candidateId');

    let clientToUse = supabase;
    let isAdmin = user ? ADMIN_LIST.includes(user.email || '') : false;

    if (!user) {
      if (candidateId === '00000000-0000-0000-0000-000000000000') {
        clientToUse = getAdminClient();
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId parameter is required' }, { status: 400 });
    }

    // Security check: Candidates can only fetch their own chat; Admins can fetch any
    if (user && !isAdmin && user.id !== candidateId) {
      return NextResponse.json({ error: 'Access denied. Unauthorized chat access.' }, { status: 403 });
    }

    // Dynamically mark incoming messages from the opposite party as read
    const opposingSenderType = isAdmin ? 'CANDIDATE' : 'ADMIN';
    await clientToUse
      .from('messages')
      .update({ is_read: true })
      .eq('candidate_id', candidateId)
      .eq('sender_type', opposingSenderType)
      .eq('is_read', false);

    // Fetch messages sorted by creation date
    const { data: messages, error } = await clientToUse
      .from('messages')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const serializedMessages = (messages || []).map((m: any) => ({
      id: m.id,
      content: m.content,
      senderType: m.sender_type,
      createdAt: m.created_at,
      isRead: m.is_read
    }));

    return NextResponse.json({ success: true, messages: serializedMessages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { candidateId, content, senderType, isDemo } = body;

    if (!candidateId || !content?.trim() || !senderType) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    let clientToUse = supabase;
    let isAdmin = user ? ADMIN_LIST.includes(user.email || '') : false;

    if (!user) {
      if (isDemo && candidateId === '00000000-0000-0000-0000-000000000000') {
        clientToUse = getAdminClient();
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Role-based Security Enforcement
    if (user) {
      if (isAdmin) {
        if (senderType !== 'ADMIN') {
          return NextResponse.json({ error: 'Admins can only send messages as ADMIN.' }, { status: 403 });
        }
      } else {
        if (senderType !== 'CANDIDATE') {
          return NextResponse.json({ error: 'Candidates can only send messages as CANDIDATE.' }, { status: 403 });
        }
        if (user.id !== candidateId) {
          return NextResponse.json({ error: 'Access denied. Unauthorized chat sender.' }, { status: 403 });
        }
      }
    }

    // Save message to database
    const { data: message, error } = await clientToUse
      .from('messages')
      .insert({
        candidate_id: candidateId,
        content: content.trim(),
        sender_type: senderType,
        is_read: false,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Alert HR Admins on new candidate messages
    if (senderType === 'CANDIDATE') {
      const candidateName = user ? (user.user_metadata?.full_name || 'Candidate') : 'Jane Doe (Demo)';
      const primaryAdmin = ADMIN_LIST[0] || 'admin@yourdomain.com';
      
      sendAdminAlertEmail(
        primaryAdmin,
        candidateName,
        'CHAT',
        content.trim()
      ).catch((e) => console.error('Failed to send admin chat alert email:', e));
    }

    const serializedMessage = {
      id: message.id,
      content: message.content,
      senderType: message.sender_type,
      createdAt: message.created_at,
      isRead: message.is_read
    };

    return NextResponse.json({ success: true, message: serializedMessage });
  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
