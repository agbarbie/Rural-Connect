--
-- PostgreSQL database dump
--

\restrict Jg6rqIsM7cF3iQDuecloiFZyU4vzGl0xgvbb0KwnoXC4KTP7HHuAyPc8PexUBku

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2026-01-24 08:56:46

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16702)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5645 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 280 (class 1255 OID 49227)
-- Name: cleanup_expired_profile_shares(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_expired_profile_shares() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM profile_shares
  WHERE expires_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_profile_shares() OWNER TO postgres;

--
-- TOC entry 286 (class 1255 OID 98367)
-- Name: enforce_single_primary_cv(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_single_primary_cv() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If setting as primary, unset others for the user
  IF NEW.is_primary = true THEN
    UPDATE cvs SET is_primary = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enforce_single_primary_cv() OWNER TO postgres;

--
-- TOC entry 285 (class 1255 OID 98361)
-- Name: ensure_single_primary_cv(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_single_primary_cv() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If setting a CV as primary
  IF NEW.is_primary = true THEN
    -- Set all other CVs for this user to non-primary
    UPDATE cvs 
    SET is_primary = false, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id 
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_single_primary_cv() OWNER TO postgres;

--
-- TOC entry 284 (class 1255 OID 73769)
-- Name: fix_permissions_jsonb(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fix_permissions_jsonb() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If permissions is null, empty array, or the string 'null', set default
    IF NEW.permissions IS NULL 
       OR NEW.permissions::text IN ('null', '[]', '""', '') THEN
        NEW.permissions = '["all"]'::jsonb;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fix_permissions_jsonb() OWNER TO postgres;

--
-- TOC entry 281 (class 1255 OID 49298)
-- Name: increment_profile_view_count(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_profile_view_count(token_param character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE profile_shares 
  SET view_count = view_count + 1 
  WHERE share_token = token_param 
    AND expires_at > NOW()
    AND is_active = true;
END;
$$;


ALTER FUNCTION public.increment_profile_view_count(token_param character varying) OWNER TO postgres;

--
-- TOC entry 302 (class 1255 OID 131111)
-- Name: populate_notification_related_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.populate_notification_related_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.related_id IS NULL AND NEW.metadata IS NOT NULL THEN
        -- Try enrollment_id first
        IF NEW.metadata->>'enrollment_id' IS NOT NULL THEN
            NEW.related_id := (NEW.metadata->>'enrollment_id')::UUID;
        -- Then try training_id
        ELSIF NEW.metadata->>'training_id' IS NOT NULL THEN
            NEW.related_id := (NEW.metadata->>'training_id')::UUID;
        -- Then try certificate_id
        ELSIF NEW.metadata->>'certificate_id' IS NOT NULL THEN
            NEW.related_id := (NEW.metadata->>'certificate_id')::UUID;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.populate_notification_related_id() OWNER TO postgres;

--
-- TOC entry 293 (class 1255 OID 114738)
-- Name: update_notifications_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_notifications_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_notifications_updated_at() OWNER TO postgres;

--
-- TOC entry 287 (class 1255 OID 139439)
-- Name: update_ratings_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_ratings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_ratings_updated_at() OWNER TO postgres;

--
-- TOC entry 288 (class 1255 OID 114729)
-- Name: update_training_enrolled_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_training_enrolled_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment count when new enrollment added
    UPDATE trainings 
    SET enrolled_count = enrolled_count + 1 
    WHERE id = NEW.training_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement count when enrollment removed
    UPDATE trainings 
    SET enrolled_count = GREATEST(enrolled_count - 1, 0)
    WHERE id = OLD.training_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_training_enrolled_count() OWNER TO postgres;

--
-- TOC entry 282 (class 1255 OID 57437)
-- Name: update_training_student_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_training_student_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE trainings 
        SET total_students = total_students + 1 
        WHERE id = NEW.training_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE trainings 
        SET total_students = GREATEST(total_students - 1, 0)
        WHERE id = OLD.training_id;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_training_student_count() OWNER TO postgres;

--
-- TOC entry 283 (class 1255 OID 57439)
-- Name: update_training_video_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_training_video_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE trainings 
        SET video_count = video_count + 1 
        WHERE id = NEW.training_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE trainings 
        SET video_count = GREATEST(video_count - 1, 0)
        WHERE id = OLD.training_id;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_training_video_count() OWNER TO postgres;

--
-- TOC entry 300 (class 1255 OID 114846)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 16879)
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    industry character varying(100),
    company_size character varying(50),
    founded_year integer,
    headquarters character varying(255),
    website_url text,
    logo_url text,
    company_password character varying(255),
    is_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 25472)
-- Name: job_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    cover_letter text,
    resume_id uuid,
    portfolio_url character varying(500),
    expected_salary numeric(10,2),
    availability_date date,
    status character varying(20) DEFAULT 'pending'::character varying,
    applied_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    employer_notes text,
    CONSTRAINT job_applications_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'reviewed'::character varying, 'shortlisted'::character varying, 'rejected'::character varying, 'withdrawn'::character varying])::text[])))
);


ALTER TABLE public.job_applications OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16925)
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    requirements text,
    responsibilities text,
    location character varying(255) NOT NULL,
    employment_type character varying(50) NOT NULL,
    work_arrangement character varying(50) NOT NULL,
    salary_min integer,
    salary_max integer,
    currency character varying(3) DEFAULT 'USD'::character varying,
    skills_required text[],
    experience_level character varying(50),
    education_level character varying(100),
    benefits text[],
    department character varying(100),
    status character varying(20) DEFAULT 'Open'::character varying,
    application_deadline date,
    is_featured boolean DEFAULT false,
    views_count integer DEFAULT 0,
    applications_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    category_id uuid,
    job_type character varying(50) DEFAULT 'full-time'::character varying
);


ALTER TABLE public.jobs OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16448)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    name character varying(255) DEFAULT 'User'::character varying NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    user_type character varying(50) NOT NULL,
    location character varying(255),
    contact_number character varying(20),
    company_name character varying(255),
    company_password character varying(255),
    role_in_company character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reset_password_token character varying(255),
    reset_password_expires timestamp without time zone,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_picture text,
    first_name character varying(100),
    last_name character varying(100),
    deleted_at timestamp without time zone,
    account_status character varying(50) DEFAULT 'active'::character varying,
    verification_status character varying(50) DEFAULT 'verified'::character varying,
    CONSTRAINT users_name_not_empty CHECK (((name IS NOT NULL) AND (length(TRIM(BOTH FROM name)) > 0)))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 106535)
-- Name: active_job_applications; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.active_job_applications AS
 SELECT ja.id,
    ja.user_id,
    ja.job_id,
    ja.cover_letter,
    ja.resume_id,
    ja.portfolio_url,
    ja.expected_salary,
    ja.availability_date,
    ja.status,
    ja.applied_at,
    ja.updated_at,
    ja.employer_notes,
    j.title AS job_title,
    j.company_id,
    c.name AS company_name,
    u.email AS applicant_email,
    u.first_name,
    u.last_name
   FROM (((public.job_applications ja
     JOIN public.jobs j ON ((ja.job_id = j.id)))
     LEFT JOIN public.companies c ON ((j.company_id = c.id)))
     JOIN public.users u ON ((ja.user_id = u.id)))
  WHERE ((ja.status)::text <> 'withdrawn'::text);


ALTER VIEW public.active_job_applications OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 139303)
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    details text,
    performed_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 41223)
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    user_type character varying(50) DEFAULT 'admin'::character varying NOT NULL,
    contact_number character varying(20),
    role character varying(50) DEFAULT 'admin'::character varying,
    user_id uuid DEFAULT gen_random_uuid(),
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 41196)
-- Name: admins_backup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins_backup (
    id integer,
    name character varying(255),
    email character varying(255),
    password_hash character varying(255),
    user_type character varying(50),
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    contact_number character varying(20),
    role character varying(50),
    user_id uuid,
    permissions jsonb
);


ALTER TABLE public.admins_backup OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 41222)
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admins_id_seq OWNER TO postgres;

--
-- TOC entry 5646 (class 0 OID 0)
-- Dependencies: 246
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- TOC entry 232 (class 1259 OID 25407)
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 41091)
-- Name: cv_certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cv_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cv_id uuid NOT NULL,
    certification_name character varying(255) NOT NULL,
    issuer character varying(255) NOT NULL,
    date_issued character varying(10) NOT NULL,
    expiry_date character varying(10),
    credential_id character varying(255),
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cv_certifications OWNER TO postgres;

--
-- TOC entry 5647 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE cv_certifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cv_certifications IS 'Professional certifications in CVs';


--
-- TOC entry 240 (class 1259 OID 41043)
-- Name: cv_education; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cv_education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cv_id uuid NOT NULL,
    institution character varying(255) NOT NULL,
    degree character varying(255) NOT NULL,
    field_of_study character varying(255) NOT NULL,
    start_year character varying(4),
    end_year character varying(4),
    gpa character varying(20),
    achievements text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cv_education OWNER TO postgres;

--
-- TOC entry 5648 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE cv_education; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cv_education IS 'Education history in CVs';


--
-- TOC entry 239 (class 1259 OID 41026)
-- Name: cv_personal_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cv_personal_info (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cv_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    address text,
    linkedin_url text,
    website_url text,
    professional_summary text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    profile_image text
);


ALTER TABLE public.cv_personal_info OWNER TO postgres;

--
-- TOC entry 5649 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE cv_personal_info; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cv_personal_info IS 'Personal information section of CVs';


--
-- TOC entry 5650 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN cv_personal_info.profile_image; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cv_personal_info.profile_image IS 'URL or path to the user profile image for the CV';


--
-- TOC entry 244 (class 1259 OID 41107)
-- Name: cv_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cv_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cv_id uuid NOT NULL,
    project_name character varying(255) NOT NULL,
    description text,
    technologies text,
    start_date character varying(10),
    end_date character varying(10),
    github_link text,
    demo_link text,
    outcomes text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cv_projects OWNER TO postgres;

--
-- TOC entry 5651 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE cv_projects; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cv_projects IS 'Project portfolios in CVs';


--
-- TOC entry 242 (class 1259 OID 41076)
-- Name: cv_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cv_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cv_id uuid NOT NULL,
    skill_name character varying(100) NOT NULL,
    skill_level character varying(20) NOT NULL,
    category character varying(100) NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cv_skills_skill_level_check CHECK (((skill_level)::text = ANY ((ARRAY['Beginner'::character varying, 'Intermediate'::character varying, 'Advanced'::character varying, 'Expert'::character varying])::text[])))
);


ALTER TABLE public.cv_skills OWNER TO postgres;

--
-- TOC entry 5652 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE cv_skills; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cv_skills IS 'Skills listed in CVs';


--
-- TOC entry 241 (class 1259 OID 41059)
-- Name: cv_work_experience; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cv_work_experience (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cv_id uuid NOT NULL,
    company character varying(255) NOT NULL,
    "position" character varying(255) NOT NULL,
    start_date character varying(10) NOT NULL,
    end_date character varying(10),
    is_current boolean DEFAULT false,
    responsibilities text NOT NULL,
    achievements text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cv_work_experience OWNER TO postgres;

--
-- TOC entry 5653 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE cv_work_experience; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cv_work_experience IS 'Work experience entries in CVs';


--
-- TOC entry 238 (class 1259 OID 41008)
-- Name: cvs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cvs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    parsed_from_file boolean DEFAULT false,
    original_filename character varying(255),
    file_url character varying(500),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_primary boolean DEFAULT false NOT NULL,
    title character varying(255) DEFAULT 'My CV'::character varying,
    cv_data jsonb,
    CONSTRAINT cvs_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'final'::character varying])::text[])))
);


ALTER TABLE public.cvs OWNER TO postgres;

--
-- TOC entry 5654 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE cvs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cvs IS 'Main CVs table storing CV metadata and status';


--
-- TOC entry 221 (class 1259 OID 16905)
-- Name: employers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    role_in_company character varying(100),
    department character varying(100),
    can_post_jobs boolean DEFAULT true,
    can_manage_candidates boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid,
    company_name character varying(255),
    business_name character varying(255)
);


ALTER TABLE public.employers OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 82109)
-- Name: interviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    employer_id uuid NOT NULL,
    job_id uuid NOT NULL,
    interview_date date NOT NULL,
    interview_time time without time zone NOT NULL,
    duration integer DEFAULT 60,
    interview_type character varying(20) DEFAULT 'video'::character varying,
    location text,
    meeting_link text,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT interviews_interview_type_check CHECK (((interview_type)::text = ANY ((ARRAY['video'::character varying, 'phone'::character varying, 'in-person'::character varying])::text[]))),
    CONSTRAINT interviews_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'rescheduled'::character varying])::text[])))
);


ALTER TABLE public.interviews OWNER TO postgres;

--
-- TOC entry 5655 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE interviews; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.interviews IS 'Interview scheduling and management';


--
-- TOC entry 235 (class 1259 OID 25453)
-- Name: job_bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    saved_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.job_bookmarks OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 82082)
-- Name: job_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    message text,
    status character varying(20) DEFAULT 'sent'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    viewed_at timestamp without time zone,
    responded_at timestamp without time zone,
    CONSTRAINT job_invitations_status_check CHECK (((status)::text = ANY ((ARRAY['sent'::character varying, 'viewed'::character varying, 'accepted'::character varying, 'declined'::character varying])::text[])))
);


ALTER TABLE public.job_invitations OWNER TO postgres;

--
-- TOC entry 5656 (class 0 OID 0)
-- Dependencies: 255
-- Name: TABLE job_invitations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_invitations IS 'Invitations sent by employers to candidates';


--
-- TOC entry 237 (class 1259 OID 25501)
-- Name: job_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    user_id uuid,
    ip_address inet,
    user_agent text,
    viewed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.job_views OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 49263)
-- Name: jobseeker_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobseeker_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    bio text,
    skills jsonb DEFAULT '[]'::jsonb,
    location character varying(255),
    phone character varying(50),
    linkedin_url character varying(500),
    github_url character varying(500),
    portfolio_url character varying(500),
    resume_url character varying(500),
    years_of_experience integer DEFAULT 0,
    current_position character varying(255),
    availability_status character varying(50) DEFAULT 'open_to_opportunities'::character varying,
    preferred_job_types jsonb DEFAULT '[]'::jsonb,
    preferred_locations jsonb DEFAULT '[]'::jsonb,
    salary_expectation_min numeric(10,2),
    salary_expectation_max numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.jobseeker_profiles OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16890)
-- Name: jobseekers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobseekers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    location character varying(255),
    contact_number character varying(20),
    skills text[],
    experience_level character varying(50),
    preferred_salary_min integer,
    preferred_salary_max integer,
    availability character varying(50),
    profile_picture text,
    bio text,
    resume_url text,
    portfolio_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid,
    active_cv_id uuid
);


ALTER TABLE public.jobseekers OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 131147)
-- Name: learning_outcomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.learning_outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_id uuid NOT NULL,
    outcome_text text NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT learning_outcome_text_length CHECK (((char_length(outcome_text) > 0) AND (char_length(outcome_text) <= 500)))
);


ALTER TABLE public.learning_outcomes OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 57391)
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    related_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 5657 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notifications IS 'System-wide user notifications';


--
-- TOC entry 5658 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN notifications.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.type IS 'Types: new_job, job_updated, job_deleted, job_closed, job_filled, application_received, application_reviewed, application_shortlisted, application_rejected, application_accepted, interview_scheduled, job_saved, job_unsaved';


--
-- TOC entry 5659 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN notifications.related_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.related_id IS 'Optional foreign key to related entity (training, enrollment, etc.)';


--
-- TOC entry 251 (class 1259 OID 57390)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- TOC entry 5660 (class 0 OID 0)
-- Dependencies: 251
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 259 (class 1259 OID 114784)
-- Name: portfolio_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portfolio_settings (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    theme character varying(50) DEFAULT 'default'::character varying,
    is_public boolean DEFAULT false,
    custom_domain character varying(255),
    seo_title character varying(255),
    seo_description text,
    seo_keywords jsonb DEFAULT '[]'::jsonb,
    analytics_enabled boolean DEFAULT true,
    show_contact_form boolean DEFAULT true,
    show_download_cv boolean DEFAULT true,
    social_links jsonb DEFAULT '[]'::jsonb,
    custom_sections jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    privacy_level character varying(20) DEFAULT 'public'::character varying,
    password_protected boolean DEFAULT false,
    password_hash character varying(255),
    CONSTRAINT portfolio_settings_privacy_level_check CHECK (((privacy_level)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying, 'unlisted'::character varying])::text[])))
);


ALTER TABLE public.portfolio_settings OWNER TO postgres;

--
-- TOC entry 5661 (class 0 OID 0)
-- Dependencies: 259
-- Name: TABLE portfolio_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.portfolio_settings IS 'Stores portfolio customization settings for each user';


--
-- TOC entry 5662 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN portfolio_settings.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.portfolio_settings.user_id IS 'Foreign key to users table (UUID type)';


--
-- TOC entry 258 (class 1259 OID 114783)
-- Name: portfolio_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.portfolio_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.portfolio_settings_id_seq OWNER TO postgres;

--
-- TOC entry 5663 (class 0 OID 0)
-- Dependencies: 258
-- Name: portfolio_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.portfolio_settings_id_seq OWNED BY public.portfolio_settings.id;


--
-- TOC entry 250 (class 1259 OID 49345)
-- Name: portfolio_testimonials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portfolio_testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    author_name character varying(255) NOT NULL,
    author_position character varying(255),
    author_company character varying(255),
    author_image_url text,
    testimonial_text text NOT NULL,
    rating integer,
    is_approved boolean DEFAULT false,
    approved_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT portfolio_testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.portfolio_testimonials OWNER TO postgres;

--
-- TOC entry 5664 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE portfolio_testimonials; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.portfolio_testimonials IS 'User-submitted testimonials for portfolios';


--
-- TOC entry 263 (class 1259 OID 114827)
-- Name: portfolio_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portfolio_views (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    viewed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    viewer_ip character varying(45),
    viewer_country character varying(100),
    viewer_city character varying(100),
    user_agent text,
    referrer text
);


ALTER TABLE public.portfolio_views OWNER TO postgres;

--
-- TOC entry 5665 (class 0 OID 0)
-- Dependencies: 263
-- Name: TABLE portfolio_views; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.portfolio_views IS 'Tracks portfolio page views for analytics';


--
-- TOC entry 5666 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN portfolio_views.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.portfolio_views.user_id IS 'Foreign key to users table (UUID type)';


--
-- TOC entry 262 (class 1259 OID 114826)
-- Name: portfolio_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.portfolio_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.portfolio_views_id_seq OWNER TO postgres;

--
-- TOC entry 5667 (class 0 OID 0)
-- Dependencies: 262
-- Name: portfolio_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.portfolio_views_id_seq OWNED BY public.portfolio_views.id;


--
-- TOC entry 249 (class 1259 OID 49282)
-- Name: profile_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    share_token character varying(255) NOT NULL,
    view_count integer DEFAULT 0,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);


ALTER TABLE public.profile_shares OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 139338)
-- Name: profile_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    viewer_id uuid NOT NULL,
    viewed_profile_id uuid NOT NULL,
    viewed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.profile_views OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 139403)
-- Name: ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ratings (
    id integer NOT NULL,
    employer_id uuid NOT NULL,
    jobseeker_id uuid NOT NULL,
    job_id uuid,
    job_title character varying(255),
    employer_name character varying(255),
    rating integer NOT NULL,
    feedback text NOT NULL,
    would_hire_again boolean DEFAULT false,
    skills_rating jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    employer_email character varying(255),
    employer_image character varying(500),
    user_type character varying(50) DEFAULT 'Employer'::character varying,
    company_name character varying(255),
    company_logo character varying(500),
    role_in_company character varying(255),
    company_description text,
    company_industry character varying(255),
    company_size character varying(100),
    company_website character varying(500),
    company_location character varying(255),
    is_public boolean DEFAULT true,
    application_id uuid,
    task_description text,
    CONSTRAINT ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.ratings OWNER TO postgres;

--
-- TOC entry 5668 (class 0 OID 0)
-- Dependencies: 269
-- Name: TABLE ratings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ratings IS 'Stores ratings given by employers to jobseekers after job completion';


--
-- TOC entry 5669 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN ratings.employer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ratings.employer_id IS 'UUID reference to employer (users table)';


--
-- TOC entry 5670 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN ratings.jobseeker_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ratings.jobseeker_id IS 'UUID reference to jobseeker (users table)';


--
-- TOC entry 5671 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN ratings.skills_rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ratings.skills_rating IS 'JSONB breakdown: {technical, communication, professionalism, quality, timeliness}';


--
-- TOC entry 268 (class 1259 OID 139402)
-- Name: ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ratings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ratings_id_seq OWNER TO postgres;

--
-- TOC entry 5672 (class 0 OID 0)
-- Dependencies: 268
-- Name: ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ratings_id_seq OWNED BY public.ratings.id;


--
-- TOC entry 233 (class 1259 OID 25418)
-- Name: resumes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    file_url character varying(500),
    file_name character varying(200),
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.resumes OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 82055)
-- Name: shortlisted_candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shortlisted_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.shortlisted_candidates OWNER TO postgres;

--
-- TOC entry 5673 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE shortlisted_candidates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.shortlisted_candidates IS 'Tracks candidates shortlisted by employers';


--
-- TOC entry 223 (class 1259 OID 16996)
-- Name: skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.skills OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 114809)
-- Name: testimonials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.testimonials (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    author character varying(255) NOT NULL,
    "position" character varying(255),
    company character varying(255),
    avatar_url character varying(500),
    rating integer,
    is_featured boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.testimonials OWNER TO postgres;

--
-- TOC entry 5674 (class 0 OID 0)
-- Dependencies: 261
-- Name: TABLE testimonials; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.testimonials IS 'Stores testimonials/recommendations for user portfolios';


--
-- TOC entry 5675 (class 0 OID 0)
-- Dependencies: 261
-- Name: COLUMN testimonials.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.testimonials.user_id IS 'Foreign key to users table (UUID type)';


--
-- TOC entry 260 (class 1259 OID 114808)
-- Name: testimonials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.testimonials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.testimonials_id_seq OWNER TO postgres;

--
-- TOC entry 5676 (class 0 OID 0)
-- Dependencies: 260
-- Name: testimonials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.testimonials_id_seq OWNED BY public.testimonials.id;


--
-- TOC entry 229 (class 1259 OID 25236)
-- Name: training_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.training_categories OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 25191)
-- Name: training_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_id uuid NOT NULL,
    user_id uuid NOT NULL,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    progress_percentage integer DEFAULT 0,
    completed_at timestamp without time zone,
    certificate_issued boolean DEFAULT false,
    certificate_url text,
    status character varying(20) DEFAULT 'enrolled'::character varying,
    certificate_issued_at timestamp without time zone,
    CONSTRAINT training_enrollments_status_check CHECK (((status)::text = ANY ((ARRAY['enrolled'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'dropped'::character varying])::text[])))
);


ALTER TABLE public.training_enrollments OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 57409)
-- Name: training_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    training_id uuid,
    enrollment_id uuid,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.training_notifications OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 25177)
-- Name: training_outcomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_id uuid NOT NULL,
    outcome_text text NOT NULL,
    order_index integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.training_outcomes OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 25270)
-- Name: training_prerequisites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_prerequisites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_id uuid NOT NULL,
    prerequisite_training_id uuid NOT NULL,
    is_mandatory boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.training_prerequisites OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 25247)
-- Name: training_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating numeric(3,2) NOT NULL,
    review_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT training_reviews_rating_check CHECK (((rating >= (1)::numeric) AND (rating <= (5)::numeric)))
);


ALTER TABLE public.training_reviews OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 25216)
-- Name: training_video_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_video_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    video_id uuid NOT NULL,
    completed_at timestamp without time zone,
    watch_time_minutes integer DEFAULT 0,
    is_completed boolean DEFAULT false,
    watch_time_seconds integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.training_video_progress OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 25162)
-- Name: training_videos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.training_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    video_url text,
    duration_minutes integer NOT NULL,
    order_index integer NOT NULL,
    is_preview boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.training_videos OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 25137)
-- Name: trainings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trainings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    category character varying(100) NOT NULL,
    level character varying(20) NOT NULL,
    duration_hours integer NOT NULL,
    cost_type character varying(10) NOT NULL,
    price numeric(10,2) DEFAULT 0.00,
    mode character varying(10) NOT NULL,
    provider_id uuid NOT NULL,
    provider_name character varying(255) NOT NULL,
    has_certificate boolean DEFAULT false,
    rating numeric(3,2) DEFAULT 0.00,
    total_students integer DEFAULT 0,
    thumbnail_url text,
    location character varying(255),
    start_date date,
    end_date date,
    max_participants integer,
    current_participants integer DEFAULT 0,
    status character varying(20) DEFAULT 'draft'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    duration integer,
    video_count integer DEFAULT 0,
    enrolled_count integer DEFAULT 0,
    CONSTRAINT trainings_cost_type_check CHECK (((cost_type)::text = ANY ((ARRAY['Free'::character varying, 'Paid'::character varying])::text[]))),
    CONSTRAINT trainings_level_check CHECK (((level)::text = ANY ((ARRAY['Beginner'::character varying, 'Intermediate'::character varying, 'Advanced'::character varying])::text[]))),
    CONSTRAINT trainings_mode_check CHECK (((mode)::text = ANY ((ARRAY['Online'::character varying, 'Offline'::character varying])::text[]))),
    CONSTRAINT trainings_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'suspended'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.trainings OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 25434)
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    experience_level character varying(20),
    expected_salary numeric(10,2),
    preferred_location character varying(100),
    remote_preference boolean DEFAULT false,
    skills text[],
    bio text,
    portfolio_url character varying(500),
    linkedin_url character varying(500),
    github_url character varying(500),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT user_profiles_experience_level_check CHECK (((experience_level)::text = ANY ((ARRAY['Entry'::character varying, 'Mid'::character varying, 'Senior'::character varying, 'Executive'::character varying])::text[])))
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 131113)
-- Name: video_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    video_id uuid NOT NULL,
    training_id uuid NOT NULL,
    watch_time integer DEFAULT 0,
    completed boolean DEFAULT false,
    last_watched_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.video_progress OWNER TO postgres;

--
-- TOC entry 5017 (class 2604 OID 41226)
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- TOC entry 5040 (class 2604 OID 57394)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 5062 (class 2604 OID 114787)
-- Name: portfolio_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portfolio_settings ALTER COLUMN id SET DEFAULT nextval('public.portfolio_settings_id_seq'::regclass);


--
-- TOC entry 5078 (class 2604 OID 114830)
-- Name: portfolio_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portfolio_views ALTER COLUMN id SET DEFAULT nextval('public.portfolio_views_id_seq'::regclass);


--
-- TOC entry 5094 (class 2604 OID 139406)
-- Name: ratings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings ALTER COLUMN id SET DEFAULT nextval('public.ratings_id_seq'::regclass);


--
-- TOC entry 5074 (class 2604 OID 114812)
-- Name: testimonials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testimonials ALTER COLUMN id SET DEFAULT nextval('public.testimonials_id_seq'::regclass);


-- Completed on 2026-01-24 08:56:47

--
-- PostgreSQL database dump complete
--

\unrestrict Jg6rqIsM7cF3iQDuecloiFZyU4vzGl0xgvbb0KwnoXC4KTP7HHuAyPc8PexUBku

