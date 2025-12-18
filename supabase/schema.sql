-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE client_status AS ENUM ('new', 'contacted', 'in_progress', 'won', 'lost');
CREATE TYPE interaction_type AS ENUM ('call', 'email', 'meeting', 'other');
CREATE TYPE interaction_direction AS ENUM ('inbound', 'outbound');

-- Table: clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  status client_status NOT NULL DEFAULT 'new',
  source TEXT,
  notes_summary TEXT
);

-- Table: interactions
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type interaction_type NOT NULL,
  direction interaction_direction,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER,
  subject TEXT NOT NULL,
  notes TEXT
);

-- Table: reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  done BOOLEAN NOT NULL DEFAULT false
);

-- Table: client_notes
CREATE TABLE client_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own clients"
  ON clients FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for interactions
CREATE POLICY "Users can view interactions for their clients"
  ON interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = interactions.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert interactions for their clients"
  ON interactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = interactions.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update interactions for their clients"
  ON interactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = interactions.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete interactions for their clients"
  ON interactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = interactions.client_id
      AND clients.owner_id = auth.uid()
    )
  );

-- RLS Policies for reminders
CREATE POLICY "Users can view reminders for their clients"
  ON reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reminders for their clients"
  ON reminders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reminders for their clients"
  ON reminders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reminders for their clients"
  ON reminders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  );

-- RLS Policies for client_notes
CREATE POLICY "Users can view notes for their clients"
  ON client_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_notes.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert notes for their clients"
  ON client_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_notes.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update notes for their clients"
  ON client_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_notes.client_id
      AND clients.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete notes for their clients"
  ON client_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_notes.client_id
      AND clients.owner_id = auth.uid()
    )
  );

-- Indexes for better performance
CREATE INDEX idx_clients_owner_id ON clients(owner_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_interactions_client_id ON interactions(client_id);
CREATE INDEX idx_interactions_date ON interactions(date);
CREATE INDEX idx_reminders_client_id ON reminders(client_id);
CREATE INDEX idx_reminders_due_at ON reminders(due_at);
CREATE INDEX idx_reminders_done ON reminders(done);
CREATE INDEX idx_client_notes_client_id ON client_notes(client_id);
CREATE INDEX idx_client_notes_pinned ON client_notes(pinned);



