-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data ->> 'display_name', new.email));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create songs table
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bpm NUMERIC,
  duration NUMERIC NOT NULL DEFAULT 0,
  in_setlist BOOLEAN NOT NULL DEFAULT false,
  setlist_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own songs"
ON public.songs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own songs"
ON public.songs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own songs"
ON public.songs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own songs"
ON public.songs FOR DELETE
USING (auth.uid() = user_id);

-- Create tracks table
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  volume NUMERIC NOT NULL DEFAULT 1,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_click BOOLEAN NOT NULL DEFAULT false,
  track_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracks of their songs"
ON public.tracks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = tracks.song_id AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can create tracks for their songs"
ON public.tracks FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = tracks.song_id AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can update tracks of their songs"
ON public.tracks FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = tracks.song_id AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can delete tracks of their songs"
ON public.tracks FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = tracks.song_id AND songs.user_id = auth.uid()
));

-- Create sections table
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sections of their songs"
ON public.sections FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = sections.song_id AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can create sections for their songs"
ON public.sections FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = sections.song_id AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can update sections of their songs"
ON public.sections FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = sections.song_id AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can delete sections of their songs"
ON public.sections FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.songs WHERE songs.id = sections.song_id AND songs.user_id = auth.uid()
));

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-tracks', 'audio-tracks', false);

-- Storage policies
CREATE POLICY "Users can upload their own audio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-tracks' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-tracks' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own audio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-tracks' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_songs_updated_at
BEFORE UPDATE ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();