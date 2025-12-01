--
-- PostgreSQL database dump
--

\restrict deO1YDE9KyqgBbcZixENwTheAvXCluPW4qazRHuzhChdk1dP5bFkT5MKbYVqiJm

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: trg_finiquito_contrato_upd(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_finiquito_contrato_upd() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.contrato
     SET estado = 'finiquitado',
         fecha_termino = COALESCE(fecha_termino, NEW.fecha_finiquito)
   WHERE id_contrato = NEW.id_contrato;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_finiquito_contrato_upd() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: afp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.afp (
    id_afp integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tasa_descuento numeric(5,2) NOT NULL,
    CONSTRAINT afp_tasa_descuento_check CHECK (((tasa_descuento >= (0)::numeric) AND (tasa_descuento <= (100)::numeric)))
);


ALTER TABLE public.afp OWNER TO postgres;

--
-- Name: afp_id_afp_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.afp_id_afp_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.afp_id_afp_seq OWNER TO postgres;

--
-- Name: afp_id_afp_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.afp_id_afp_seq OWNED BY public.afp.id_afp;


--
-- Name: anexo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anexo (
    id_anexo integer CONSTRAINT anexos_id_anexos_not_null NOT NULL,
    id_contrato integer CONSTRAINT anexos_id_contrato_not_null NOT NULL,
    fecha date CONSTRAINT anexos_fecha_not_null NOT NULL,
    tipo_cambio character varying(30) CONSTRAINT anexos_tipo_cambio_not_null NOT NULL,
    detalle text CONSTRAINT anexos_detalle_not_null NOT NULL,
    valor_anterior character varying(100) CONSTRAINT anexos_valor_antertior_not_null NOT NULL,
    valor_nuevo character varying(100) CONSTRAINT anexos_valor_nuevo_not_null NOT NULL,
    documento_url character varying(255),
    creado_en timestamp with time zone DEFAULT now() CONSTRAINT anexos_creado_en_not_null NOT NULL,
    CONSTRAINT anexo_cambio_chk CHECK ((lower((tipo_cambio)::text) = ANY (ARRAY['sueldo'::text, 'jornada'::text, 'cargo'::text, 'horario'::text, 'otros'::text]))),
    CONSTRAINT anexo_tipo_cambio_chk CHECK ((lower((tipo_cambio)::text) = ANY (ARRAY['sueldo'::text, 'jornada'::text, 'cargo'::text, 'horario'::text, 'otros'::text])))
);


ALTER TABLE public.anexo OWNER TO postgres;

--
-- Name: anexos_id_anexos_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.anexos_id_anexos_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.anexos_id_anexos_seq OWNER TO postgres;

--
-- Name: anexos_id_anexos_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anexos_id_anexos_seq OWNED BY public.anexo.id_anexo;


--
-- Name: anexos_id_contrato_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.anexos_id_contrato_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.anexos_id_contrato_seq OWNER TO postgres;

--
-- Name: anexos_id_contrato_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anexos_id_contrato_seq OWNED BY public.anexo.id_contrato;


--
-- Name: asistencia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia (
    id_asistencia integer NOT NULL,
    id_empleado integer NOT NULL,
    fecha date NOT NULL,
    hora_entrada time with time zone,
    hora_salida time with time zone,
    minutos_colacion integer DEFAULT 60 NOT NULL,
    horas_trabajadas numeric(5,2) NOT NULL,
    horas_extra numeric(5,2) CONSTRAINT asistencia_horas_extras_not_null NOT NULL,
    estado character varying(20) NOT NULL,
    observacion text,
    CONSTRAINT asistencia_colacion_chk CHECK (((minutos_colacion >= 0) AND (minutos_colacion <= 120))),
    CONSTRAINT asistencia_estado_chk CHECK ((lower((estado)::text) = ANY (ARRAY['presente'::text, 'ausente'::text, 'permiso'::text, 'licencia'::text, 'vacaciones'::text]))),
    CONSTRAINT asistencia_horas_nn_chk CHECK (((COALESCE(horas_trabajadas, (0)::numeric) >= (0)::numeric) AND (COALESCE(horas_extra, (0)::numeric) >= (0)::numeric)))
);


ALTER TABLE public.asistencia OWNER TO postgres;

--
-- Name: asistencia_id_asistencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.asistencia ALTER COLUMN id_asistencia ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.asistencia_id_asistencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: capacitaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capacitaciones (
    id_capacitacion integer NOT NULL,
    id_empleado integer NOT NULL,
    titulo character varying(200) NOT NULL,
    fecha date NOT NULL,
    tipo character varying(100),
    descripcion text,
    documento_url text,
    creado_en timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.capacitaciones OWNER TO postgres;

--
-- Name: capacitaciones_id_capacitacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.capacitaciones_id_capacitacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.capacitaciones_id_capacitacion_seq OWNER TO postgres;

--
-- Name: capacitaciones_id_capacitacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.capacitaciones_id_capacitacion_seq OWNED BY public.capacitaciones.id_capacitacion;


--
-- Name: contrato; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contrato (
    id_contrato integer NOT NULL,
    id_empleado integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_termino date,
    tipo character varying(20) DEFAULT 'indefinido'::character varying NOT NULL,
    jornada character varying(20) DEFAULT 'completa'::character varying NOT NULL,
    cargo_contratado character varying(100) NOT NULL,
    sueldo_base_contrato numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'vigente'::character varying NOT NULL,
    observaciones text,
    archivo_pdf text,
    CONSTRAINT contrato_estado_chk CHECK ((lower((estado)::text) = ANY (ARRAY['vigente'::text, 'finiquitado'::text]))),
    CONSTRAINT contrato_jornada_chk CHECK ((lower((jornada)::text) = ANY (ARRAY['completa'::text, 'parcial'::text]))),
    CONSTRAINT contrato_tipo_chk CHECK ((lower((tipo)::text) = ANY (ARRAY['plazo fijo'::text, 'indefinido'::text]))),
    CONSTRAINT contratos_estado_chk CHECK ((lower((estado)::text) = ANY (ARRAY['vigente'::text, 'finiquitado'::text]))),
    CONSTRAINT contratos_jornada_chk CHECK ((lower((jornada)::text) = ANY (ARRAY['completa'::text, 'parcial'::text]))),
    CONSTRAINT contratos_tipo_chk CHECK ((lower((tipo)::text) = ANY (ARRAY['plazo fijo'::text, 'indefinido'::text])))
);


ALTER TABLE public.contrato OWNER TO postgres;

--
-- Name: contrato_id_contrato_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contrato_id_contrato_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contrato_id_contrato_seq OWNER TO postgres;

--
-- Name: contrato_id_contrato_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contrato_id_contrato_seq OWNED BY public.contrato.id_contrato;


--
-- Name: documentos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documentos (
    id_documento integer NOT NULL,
    modulo character varying(50) NOT NULL,
    entidad_id integer NOT NULL,
    id_empleado_owner integer,
    titulo character varying(200) NOT NULL,
    mime_type character varying(100) DEFAULT 'application/pdf'::character varying,
    storage_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    creado_en timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.documentos OWNER TO postgres;

--
-- Name: documentos_generados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documentos_generados (
    id_documento integer NOT NULL,
    id_empleado integer NOT NULL,
    id_contrato integer,
    id_anexo integer,
    id_finiquito integer,
    id_liquidacion integer,
    tipo_documento character varying(20) NOT NULL,
    periodo character(7),
    nombre_archivo character varying(200) NOT NULL,
    url_archivo character varying(255) NOT NULL,
    hash_archivo character varying(128),
    firmado boolean DEFAULT false NOT NULL,
    generado_en timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    CONSTRAINT docgen_exclusive_ref_chk CHECK (((((
CASE
    WHEN (id_contrato IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN (id_anexo IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (id_finiquito IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (id_liquidacion IS NOT NULL) THEN 1
    ELSE 0
END) = 1)),
    CONSTRAINT docgen_tipo_chk CHECK ((lower((tipo_documento)::text) = ANY (ARRAY['contrato'::text, 'anexo'::text, 'finiquito'::text, 'liquidacion'::text])))
);


ALTER TABLE public.documentos_generados OWNER TO postgres;

--
-- Name: documentos_generados_id_documento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documentos_generados_id_documento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documentos_generados_id_documento_seq OWNER TO postgres;

--
-- Name: documentos_generados_id_documento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documentos_generados_id_documento_seq OWNED BY public.documentos_generados.id_documento;


--
-- Name: documentos_id_documento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documentos_id_documento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documentos_id_documento_seq OWNER TO postgres;

--
-- Name: documentos_id_documento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documentos_id_documento_seq OWNED BY public.documentos.id_documento;


--
-- Name: empleados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empleados (
    id_empleado integer NOT NULL,
    id_usuario integer,
    nombre character varying(50) NOT NULL,
    apellido_paterno character varying(50) NOT NULL,
    apellido_materno character varying(50),
    rut character varying(8) NOT NULL,
    digito_verificador character(1) NOT NULL,
    direccion character varying(200),
    telefono character varying(20),
    correo character varying(100) NOT NULL,
    fecha_ingreso date NOT NULL,
    cargo character varying(100) NOT NULL,
    sueldo_base numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    id_afp integer,
    id_salud integer,
    fecha_nacimiento date,
    CONSTRAINT empleados_estado_chk CHECK ((lower((estado)::text) = ANY (ARRAY['activo'::text, 'inactivo'::text])))
);


ALTER TABLE public.empleados OWNER TO postgres;

--
-- Name: empleados_id_empleado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.empleados_id_empleado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empleados_id_empleado_seq OWNER TO postgres;

--
-- Name: empleados_id_empleado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.empleados_id_empleado_seq OWNED BY public.empleados.id_empleado;


--
-- Name: feriados_irrenunciables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feriados_irrenunciables (
    fecha date NOT NULL,
    descripcion text
);


ALTER TABLE public.feriados_irrenunciables OWNER TO postgres;

--
-- Name: finiquitos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finiquitos (
    id_finiquito integer NOT NULL,
    id_contrato integer NOT NULL,
    fecha_finiquito date NOT NULL,
    causal character varying(100) NOT NULL,
    monto_total numeric(12,2) NOT NULL,
    detalle text,
    documento_url character varying(255),
    firmado boolean DEFAULT false NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finiquitos_causal_chk CHECK ((lower((causal)::text) = ANY (ARRAY['renuncia voluntaria'::text, 'mutuo acuerdo'::text, 'necesidades de la empresa'::text, 'vencimiento de plazo'::text, 'despido disciplinario'::text, 'abandono'::text, 'fallecimiento'::text, 'otros'::text]))),
    CONSTRAINT finiquitos_monto_chk CHECK ((monto_total >= (0)::numeric))
);


ALTER TABLE public.finiquitos OWNER TO postgres;

--
-- Name: finiquitos_id_finiquito_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.finiquitos_id_finiquito_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.finiquitos_id_finiquito_seq OWNER TO postgres;

--
-- Name: finiquitos_id_finiquito_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.finiquitos_id_finiquito_seq OWNED BY public.finiquitos.id_finiquito;


--
-- Name: liquidaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.liquidaciones (
    id_liquidacion integer NOT NULL,
    id_empleado integer NOT NULL,
    id_contrato integer NOT NULL,
    periodo character(7) NOT NULL,
    dias_trabajados integer DEFAULT 0 NOT NULL,
    sueldo_base numeric(12,2) NOT NULL,
    horas_extra numeric(10,2) DEFAULT 0 NOT NULL,
    monto_horas_extra numeric(12,2) DEFAULT 0 NOT NULL,
    gratificacion numeric(12,2) DEFAULT 0 NOT NULL,
    otros_haberes numeric(12,2) DEFAULT 0 NOT NULL,
    imponible numeric(12,2) DEFAULT 0 NOT NULL,
    afp_desc numeric(12,2) DEFAULT 0 NOT NULL,
    salud_desc numeric(12,2) DEFAULT 0 NOT NULL,
    otros_descuentos numeric(12,2) DEFAULT 0 NOT NULL,
    no_imponibles numeric(12,2) DEFAULT 0 NOT NULL,
    tributable numeric(12,2) DEFAULT 0 NOT NULL,
    impuesto numeric(12,2) DEFAULT 0 NOT NULL,
    sueldo_liquido numeric(12,2) NOT NULL,
    generado_en timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    aprobado_por integer,
    aprobado_en timestamp with time zone,
    CONSTRAINT liq_nn_chk CHECK (((dias_trabajados >= 0) AND (imponible >= (0)::numeric) AND (sueldo_base >= (0)::numeric) AND (horas_extra >= (0)::numeric) AND (monto_horas_extra >= (0)::numeric) AND (afp_desc >= (0)::numeric) AND (salud_desc >= (0)::numeric) AND (otros_descuentos >= (0)::numeric) AND (no_imponibles >= (0)::numeric) AND (tributable >= (0)::numeric) AND (impuesto >= (0)::numeric) AND (sueldo_liquido >= (0)::numeric))),
    CONSTRAINT liq_periodo_fmt_chk CHECK ((periodo ~ '^[0-9]{4}-[0-1][0-9]$'::text))
);


ALTER TABLE public.liquidaciones OWNER TO postgres;

--
-- Name: liquidaciones_id_liquidacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.liquidaciones_id_liquidacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.liquidaciones_id_liquidacion_seq OWNER TO postgres;

--
-- Name: liquidaciones_id_liquidacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.liquidaciones_id_liquidacion_seq OWNED BY public.liquidaciones.id_liquidacion;


--
-- Name: salud; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salud (
    id_salud integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(20) NOT NULL,
    cotizacion numeric(5,2) NOT NULL,
    CONSTRAINT salud_cotizacion_check CHECK (((cotizacion >= (0)::numeric) AND (cotizacion <= (100)::numeric))),
    CONSTRAINT salud_tipo_check CHECK ((lower((tipo)::text) = ANY (ARRAY['fonasa'::text, 'isapre'::text])))
);


ALTER TABLE public.salud OWNER TO postgres;

--
-- Name: salud_id_salud_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.salud_id_salud_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salud_id_salud_seq OWNER TO postgres;

--
-- Name: salud_id_salud_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.salud_id_salud_seq OWNED BY public.salud.id_salud;


--
-- Name: solicitud_adjuntos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitud_adjuntos (
    id_adjunto integer NOT NULL,
    id_solicitud integer NOT NULL,
    nombre_archivo character varying(200) NOT NULL,
    url_archivo character varying(300) NOT NULL,
    hash_archivo character varying(128),
    creado_en timestamp with time zone DEFAULT now()
);


ALTER TABLE public.solicitud_adjuntos OWNER TO postgres;

--
-- Name: solicitud_adjuntos_id_adjunto_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solicitud_adjuntos_id_adjunto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solicitud_adjuntos_id_adjunto_seq OWNER TO postgres;

--
-- Name: solicitud_adjuntos_id_adjunto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solicitud_adjuntos_id_adjunto_seq OWNED BY public.solicitud_adjuntos.id_adjunto;


--
-- Name: solicitud_historial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitud_historial (
    id_historial integer NOT NULL,
    id_solicitud integer NOT NULL,
    evento character varying(30) NOT NULL,
    por_usuario integer NOT NULL,
    comentario text,
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT solicitud_historial_evento_check CHECK (((evento)::text = ANY ((ARRAY['creada'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'cancelada'::character varying, 'comentario'::character varying, 'adjunto'::character varying])::text[])))
);


ALTER TABLE public.solicitud_historial OWNER TO postgres;

--
-- Name: solicitud_historial_id_historial_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solicitud_historial_id_historial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solicitud_historial_id_historial_seq OWNER TO postgres;

--
-- Name: solicitud_historial_id_historial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solicitud_historial_id_historial_seq OWNED BY public.solicitud_historial.id_historial;


--
-- Name: solicitudes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitudes (
    id_solicitud integer NOT NULL,
    id_empleado integer NOT NULL,
    tipo character varying(30) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_desde date,
    fecha_hasta date,
    horas integer,
    monto numeric(12,2),
    motivo text,
    detalle text,
    adjuntos_count integer DEFAULT 0,
    fecha_creacion timestamp with time zone DEFAULT now(),
    resuelto_por integer,
    fecha_resolucion timestamp with time zone,
    comentario_resolucion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    asunto text,
    mensaje text,
    adjunto_url text,
    actualizado_en timestamp with time zone,
    CONSTRAINT solicitudes_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'cancelada'::character varying])::text[]))),
    CONSTRAINT solicitudes_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['vacaciones'::character varying, 'permiso'::character varying, 'justificacion'::character varying, 'anticipo'::character varying, 'certificado'::character varying])::text[])))
);


ALTER TABLE public.solicitudes OWNER TO postgres;

--
-- Name: solicitudes_id_solicitud_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solicitudes_id_solicitud_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solicitudes_id_solicitud_seq OWNER TO postgres;

--
-- Name: solicitudes_id_solicitud_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solicitudes_id_solicitud_seq OWNED BY public.solicitudes.id_solicitud;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id_usuario integer NOT NULL,
    nombre_usuario character varying(50) NOT NULL,
    correo character varying(100) NOT NULL,
    "contraseña" character varying(200) CONSTRAINT "usuarios_constraeña_not_null" NOT NULL,
    rol character varying(20) NOT NULL
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_usuario_seq OWNER TO postgres;

--
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_usuario_seq OWNED BY public.usuarios.id_usuario;


--
-- Name: afp id_afp; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afp ALTER COLUMN id_afp SET DEFAULT nextval('public.afp_id_afp_seq'::regclass);


--
-- Name: anexo id_anexo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anexo ALTER COLUMN id_anexo SET DEFAULT nextval('public.anexos_id_anexos_seq'::regclass);


--
-- Name: anexo id_contrato; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anexo ALTER COLUMN id_contrato SET DEFAULT nextval('public.anexos_id_contrato_seq'::regclass);


--
-- Name: capacitaciones id_capacitacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capacitaciones ALTER COLUMN id_capacitacion SET DEFAULT nextval('public.capacitaciones_id_capacitacion_seq'::regclass);


--
-- Name: contrato id_contrato; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contrato ALTER COLUMN id_contrato SET DEFAULT nextval('public.contrato_id_contrato_seq'::regclass);


--
-- Name: documentos id_documento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos ALTER COLUMN id_documento SET DEFAULT nextval('public.documentos_id_documento_seq'::regclass);


--
-- Name: documentos_generados id_documento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_generados ALTER COLUMN id_documento SET DEFAULT nextval('public.documentos_generados_id_documento_seq'::regclass);


--
-- Name: empleados id_empleado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados ALTER COLUMN id_empleado SET DEFAULT nextval('public.empleados_id_empleado_seq'::regclass);


--
-- Name: finiquitos id_finiquito; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finiquitos ALTER COLUMN id_finiquito SET DEFAULT nextval('public.finiquitos_id_finiquito_seq'::regclass);


--
-- Name: liquidaciones id_liquidacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.liquidaciones ALTER COLUMN id_liquidacion SET DEFAULT nextval('public.liquidaciones_id_liquidacion_seq'::regclass);


--
-- Name: salud id_salud; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salud ALTER COLUMN id_salud SET DEFAULT nextval('public.salud_id_salud_seq'::regclass);


--
-- Name: solicitud_adjuntos id_adjunto; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_adjuntos ALTER COLUMN id_adjunto SET DEFAULT nextval('public.solicitud_adjuntos_id_adjunto_seq'::regclass);


--
-- Name: solicitud_historial id_historial; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_historial ALTER COLUMN id_historial SET DEFAULT nextval('public.solicitud_historial_id_historial_seq'::regclass);


--
-- Name: solicitudes id_solicitud; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes ALTER COLUMN id_solicitud SET DEFAULT nextval('public.solicitudes_id_solicitud_seq'::regclass);


--
-- Name: usuarios id_usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuarios_id_usuario_seq'::regclass);


--
-- Data for Name: afp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.afp (id_afp, nombre, tasa_descuento) FROM stdin;
21	AFP Habitat	11.44
22	AFP Provida	11.44
23	AFP Capital	11.44
24	AFP Cuprum	11.44
29	Habitat	11.27
\.


--
-- Data for Name: anexo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.anexo (id_anexo, id_contrato, fecha, tipo_cambio, detalle, valor_anterior, valor_nuevo, documento_url, creado_en) FROM stdin;
5	7	2023-07-01	sueldo	Ajuste anual	900000	950000	docs/anexo_jperez_2023_07.pdf	2025-10-06 15:47:00.20364-03
6	9	2023-10-01	cargo	Promoción a Senior	Desarrollador	Desarrollador Senior	docs/anexo_lrojas_2023_10.pdf	2025-10-06 15:47:00.20364-03
7	7	2023-07-01	sueldo	Ajuste anual	900000	950000	docs/anexo_jperez_2023_07.pdf	2025-10-06 15:47:08.749144-03
8	10	2023-07-01	sueldo	Ajuste anual	900000	950000	docs/anexo_jperez_2023_07.pdf	2025-10-06 15:47:08.749144-03
9	9	2023-10-01	cargo	Promoción a Senior	Desarrollador	Desarrollador Senior	docs/anexo_lrojas_2023_10.pdf	2025-10-06 15:47:08.749144-03
13	14	2025-10-04	cargo	Promoción al cargo de Encargado de Logística tras evaluación de desempeño.	Asistente de Logística	Encargado de Logística	/uploads/anexos/anexo_2025_13.pdf	2025-11-03 16:57:54.02828-03
12	14	2025-09-04	jornada	Cambio de jornada de completa a parcial por solicitud del trabajador.	Completa	Parcial	/uploads/anexos/anexo_2025_12.pdf	2025-11-03 16:57:54.02828-03
11	14	2025-08-05	sueldo	Ajuste de remuneración base debido al cumplimiento de metas trimestrales.	$920,000	$1,050,000	/uploads/anexos/anexo_2025_11.pdf	2025-11-03 16:57:54.02828-03
10	12	2023-10-01	cargo	Promoción a Senior	Desarrollador	Desarrollador Senior	/uploads/anexos/anexo_2023_10.pdf	2025-10-06 15:47:08.749144-03
\.


--
-- Data for Name: asistencia; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asistencia (id_asistencia, id_empleado, fecha, hora_entrada, hora_salida, minutos_colacion, horas_trabajadas, horas_extra, estado, observacion) FROM stdin;
3	7	2024-06-03	08:30:00-03	18:00:00-03	60	8.50	0.50	presente	Jornada normal
4	7	2024-06-04	\N	\N	0	0.00	0.00	vacaciones	Día de vacaciones
5	9	2024-06-03	\N	\N	0	0.00	0.00	permiso	Trámite personal
10	14	2025-11-03	21:29:58.540666-03	21:32:07.935758-03	60	0.00	0.00	presente	\N
18	14	2025-11-02	09:00:00-03	17:30:00-03	30	8.00	0.00	presente	Jornada completa
24	7	2025-09-01	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	Inicio de mes
25	8	2025-09-01	09:05:00-03	18:00:00-03	60	7.92	0.00	presente	\N
26	9	2025-09-01	09:00:00-03	18:15:00-03	60	8.25	0.25	presente	Ajuste final
27	14	2025-09-01	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
28	34	2025-09-01	09:10:00-03	18:00:00-03	60	7.83	0.00	presente	Llegó tarde
29	7	2025-09-02	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
30	8	2025-09-02	09:00:00-03	18:10:00-03	60	8.17	0.17	presente	\N
31	9	2025-09-02	09:15:00-03	18:00:00-03	60	7.75	0.00	presente	Retraso leve
32	14	2025-09-02	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
33	34	2025-09-02	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
34	7	2025-09-03	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	Cierre mensual
35	8	2025-09-03	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	\N
36	9	2025-09-03	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	Soporte extra
37	14	2025-09-03	09:00:00-03	18:45:00-03	60	8.75	0.75	presente	\N
38	34	2025-09-03	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	\N
39	7	2025-09-04	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
40	8	2025-09-04	09:10:00-03	18:00:00-03	60	7.83	0.00	presente	Retraso por tráfico
41	9	2025-09-04	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
42	14	2025-09-04	09:05:00-03	18:05:00-03	60	8.00	0.00	presente	Ajuste de horario
43	34	2025-09-04	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
44	7	2025-09-05	09:00:00-03	19:30:00-03	60	9.50	1.50	presente	Horas extra proyecto
45	8	2025-09-05	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
46	9	2025-09-05	09:10:00-03	18:00:00-03	60	7.83	0.00	presente	\N
47	14	2025-09-05	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	\N
48	34	2025-09-05	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
49	7	2025-09-08	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	Inicio semana
50	8	2025-09-08	09:00:00-03	18:15:00-03	60	8.25	0.25	presente	\N
51	9	2025-09-08	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
52	14	2025-09-08	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
53	34	2025-09-08	09:15:00-03	18:00:00-03	60	7.75	0.00	presente	Tarde por micro
54	7	2025-09-09	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
55	8	2025-09-09	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
56	9	2025-09-09	09:05:00-03	18:00:00-03	60	7.92	0.00	presente	Pequeño atraso
57	14	2025-09-09	09:00:00-03	18:10:00-03	60	8.17	0.17	presente	\N
58	34	2025-09-09	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
59	7	2025-09-10	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	Entrega importante
60	8	2025-09-10	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	Trabajo extendido
61	9	2025-09-10	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	\N
62	14	2025-09-10	09:05:00-03	19:00:00-03	60	8.92	0.92	presente	Revisión final
63	34	2025-09-10	09:00:00-03	19:00:00-03	60	9.00	1.00	presente	\N
19	14	2025-11-11	10:44:00-03	18:44:00-03	60	8.00	0.00	presente	Dia agitado
65	34	2025-11-18	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
66	34	2025-11-19	09:00:00-03	18:00:00-03	60	8.00	0.00	presente	\N
64	14	2025-11-17	\N	\N	60	8.00	0.00	presente	
9	14	2025-11-04	10:00:00-03	20:00:00-03	60	10.00	2.00	presente	
\.


--
-- Data for Name: capacitaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.capacitaciones (id_capacitacion, id_empleado, titulo, fecha, tipo, descripcion, documento_url, creado_en) FROM stdin;
11	14	Actualización en Legislación Laboral	2025-03-15	Seminario	Revisión de las últimas modificaciones al Código del Trabajo y normativa previsional chilena, con foco en procesos de contratación y desvinculación.	\N	2025-11-05 02:52:04.862458
12	14	Liderazgo y Gestión de Equipos de Alto Desempeño	2025-04-22	Taller	Entrenamiento intensivo sobre liderazgo situacional, gestión de clima laboral y comunicación efectiva dentro de los equipos de RRHH.	\N	2025-11-05 02:52:04.862458
13	14	Transformación Digital en Recursos Humanos	2025-05-10	Curso Online	Capacitación enfocada en la digitalización de procesos de RRHH, uso de plataformas SaaS, y automatización del ciclo de vida del colaborador.	\N	2025-11-05 02:52:04.862458
14	14	Seguridad de la Información y Confidencialidad de Datos	2025-06-05	Curso	Capacitación en normativas de protección de datos personales (Ley 19.628), políticas de privacidad y buenas prácticas de ciberseguridad para administradores del sistema.	\N	2025-11-05 02:52:04.862458
15	14	Prevención de Riesgos Laborales en Ambientes Administrativos	2025-07-02	Charla	Sesión práctica sobre ergonomía, pausas activas y medidas preventivas para oficinas y estaciones de trabajo administrativas.	\N	2025-11-05 02:52:04.862458
\.


--
-- Data for Name: contrato; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contrato (id_contrato, id_empleado, fecha_inicio, fecha_termino, tipo, jornada, cargo_contratado, sueldo_base_contrato, estado, observaciones, archivo_pdf) FROM stdin;
7	7	2023-01-01	\N	indefinido	completa	Analista de Datos	900000.00	vigente	Contrato inicial	\N
9	9	2022-03-10	\N	indefinido	completa	Desarrollador	1200000.00	vigente	\N	\N
8	8	2024-02-01	2024-08-01	plazo fijo	completa	Asistente RRHH	650000.00	finiquitado	Contrato a plazo	\N
10	7	2023-01-01	\N	indefinido	completa	Analista de Datos	900000.00	vigente	Contrato inicial	\N
12	9	2022-03-10	\N	indefinido	completa	Desarrollador	1200000.00	vigente	\N	\N
14	14	2025-10-01	\N	indefinido	completa	Analista	950000.00	vigente	Contrato inicial	/uploads/contratos/contrato_2025_14.pdf
11	8	2024-02-01	2024-08-01	plazo fijo	completa	Asistente RRHH	650000.00	finiquitado	Contrato a plazo	/uploads/contratos/contrato_2024_11.pdf
15	34	2025-11-16	\N	indefinido	completa	Empleado	350000.00	vigente	\N	\N
16	36	2025-01-01	\N	indefinido	completa	Analista Junior	750000.00	vigente	Contrato inicial	\N
17	37	2024-01-10	2024-08-10	plazo fijo	completa	Asistente Administrativo	650000.00	finiquitado	Contrato expirado automáticamente	\N
19	40	2024-05-10	2024-11-10	plazo fijo	completa	Analista	720000.00	finiquitado	Contrato finalizado por término de período	/uploads/contratos/contrato_carlos.pdf
\.


--
-- Data for Name: documentos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documentos (id_documento, modulo, entidad_id, id_empleado_owner, titulo, mime_type, storage_url, metadata, creado_en) FROM stdin;
\.


--
-- Data for Name: documentos_generados; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documentos_generados (id_documento, id_empleado, id_contrato, id_anexo, id_finiquito, id_liquidacion, tipo_documento, periodo, nombre_archivo, url_archivo, hash_archivo, firmado, generado_en, observacion) FROM stdin;
1	7	7	\N	\N	\N	contrato	\N	contrato_jperez_2023_01.pdf	docs/contrato_jperez_2023_01.pdf	\N	t	2025-10-06 15:47:00.20364-03	\N
2	7	\N	5	\N	\N	anexo	\N	anexo_jperez_2023_07.pdf	docs/anexo_jperez_2023_07.pdf	\N	t	2025-10-06 15:47:00.20364-03	\N
3	8	\N	\N	3	\N	finiquito	\N	finiquito_mmartinez_2024_08.pdf	docs/finiquito_mmartinez_2024_08.pdf	\N	t	2025-10-06 15:47:00.20364-03	\N
4	7	\N	\N	\N	1	liquidacion	2024-06	liq_juan_2024_06.pdf	docs/liq_juan_2024_06.pdf	\N	t	2025-10-06 15:47:00.20364-03	\N
5	8	\N	\N	\N	2	liquidacion	2024-06	liq_maría_2024_06.pdf	docs/liq_maría_2024_06.pdf	\N	t	2025-10-06 15:47:00.20364-03	\N
7	7	10	\N	\N	\N	contrato	\N	contrato_jperez_2023_01.pdf	docs/contrato_jperez_2023_01.pdf	\N	t	2025-10-06 15:47:08.749144-03	\N
9	7	\N	7	\N	\N	anexo	\N	anexo_jperez_2023_07.pdf	docs/anexo_jperez_2023_07.pdf	\N	t	2025-10-06 15:47:08.749144-03	\N
10	7	\N	8	\N	\N	anexo	\N	anexo_jperez_2023_07.pdf	docs/anexo_jperez_2023_07.pdf	\N	t	2025-10-06 15:47:08.749144-03	\N
12	8	\N	\N	5	\N	finiquito	\N	finiquito_mmartinez_2024_08.pdf	docs/finiquito_mmartinez_2024_08.pdf	\N	t	2025-10-06 15:47:08.749144-03	\N
\.


--
-- Data for Name: empleados; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.empleados (id_empleado, id_usuario, nombre, apellido_paterno, apellido_materno, rut, digito_verificador, direccion, telefono, correo, fecha_ingreso, cargo, sueldo_base, estado, id_afp, id_salud, fecha_nacimiento) FROM stdin;
7	38	Juan	Pérez	González	12345678	K	Av. Los Álamos 123	+56911111111	jperez@empresa.cl	2023-01-01	Analista de Datos	900000.00	activo	22	21	1990-04-10
8	39	María	Martínez	Soto	87654321	1	Calle Falsa 456	+56922222222	mmartinez@empresa.cl	2024-01-15	Asistente RRHH	650000.00	activo	21	22	1992-08-15
9	40	Luis	Rojas	Araya	11112222	9	Pasaje Robles 89	+56933333333	lrojas@empresa.cl	2022-03-10	Desarrollador	1200000.00	activo	24	21	1988-12-02
14	1001	Ana	Pérez	Gómez	12345678	9	Av. Siempre Viva 742	+56912345678	usuario@empresa.cl	2025-10-01	Analista	950000.00	activo	29	21	1995-05-10
34	\N	Tomás	Bustos	Ramos	21022165	4	calle si	933090486	tomas.bustos.ramos@gmail.com	2025-11-16	Empleado	350000.00	activo	21	21	2002-05-10
36	53	Carlos	Muñoz	Torres	22222333	5	Av. Siempre Viva 742	+56 9 1234 5678	carlos.munoz@example.com	2025-11-01	Analista RRHH	750000.00	activo	22	22	1995-03-15
39	56	Carlos	Muñoz	Pérez	22444555	3	Av. Siempre Viva 123	+56 9 9876 5432	carlos2.munoz@example.com	2024-01-10	Asistente Administrativo	650000.00	activo	22	22	1995-06-15
40	58	Carlos	Rojas	Pérez	21456789	5	Calle Siempre Viva 123	+56934567890	carlos3.rojas@example.com	2024-05-10	Analista	720000.00	activo	23	23	1993-08-15
\.


--
-- Data for Name: feriados_irrenunciables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feriados_irrenunciables (fecha, descripcion) FROM stdin;
2025-05-01	Día del Trabajador
2025-09-18	Fiestas Patrias
2025-09-19	Fiestas Patrias
2025-12-25	Navidad
\.


--
-- Data for Name: finiquitos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.finiquitos (id_finiquito, id_contrato, fecha_finiquito, causal, monto_total, detalle, documento_url, firmado, creado_en) FROM stdin;
3	8	2024-08-01	vencimiento de plazo	350000.00	Término por plazo	docs/finiquito_mmartinez_2024_08.pdf	t	2025-10-06 15:47:00.20364-03
5	11	2024-08-01	vencimiento de plazo	350000.00	Término por plazo	docs/finiquito_mmartinez_2024_08.pdf	t	2025-10-06 15:47:08.749144-03
\.


--
-- Data for Name: liquidaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.liquidaciones (id_liquidacion, id_empleado, id_contrato, periodo, dias_trabajados, sueldo_base, horas_extra, monto_horas_extra, gratificacion, otros_haberes, imponible, afp_desc, salud_desc, otros_descuentos, no_imponibles, tributable, impuesto, sueldo_liquido, generado_en, observacion, estado, aprobado_por, aprobado_en) FROM stdin;
1	7	7	2024-06	20	900000.00	5.00	50000.00	0.00	0.00	950000.00	108300.00	66500.00	10000.00	0.00	881700.00	121000.00	760700.00	2025-10-06 15:47:00.20364-03	\N	borrador	\N	\N
2	8	8	2024-06	22	650000.00	0.00	0.00	0.00	0.00	650000.00	74360.00	45500.00	0.00	0.00	530000.00	62000.00	514140.00	2025-10-06 15:47:00.20364-03	\N	borrador	\N	\N
7	14	14	2025-09	22	850000.00	10.00	75000.00	85000.00	20000.00	1030000.00	107000.00	68000.00	12000.00	0.00	950000.00	45000.00	905000.00	2025-11-04 22:08:56.827367-03	Liquidación del mes de septiembre.	borrador	\N	\N
8	14	14	2025-10	23	850000.00	8.00	60000.00	85000.00	15000.00	1010000.00	105000.00	66500.00	15000.00	0.00	950000.00	43000.00	907500.00	2025-11-04 22:08:56.827367-03	Liquidación del mes de octubre.	borrador	\N	\N
9	14	14	2025-11	5	950000.00	0.00	0.00	0.00	0.00	237500.00	0.00	0.00	0.00	0.00	237500.00	0.00	237500.00	2025-11-17 22:55:55.996207-03	Liquidación del mes de Noviembre.	calculada	\N	\N
27	34	15	2025-11	2	350000.00	0.00	0.00	0.00	0.00	35000.00	0.00	0.00	0.00	0.00	35000.00	0.00	35000.00	2025-11-17 22:55:56.004219-03	\N	calculada	\N	\N
28	36	16	2025-11	0	750000.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2025-11-17 22:55:56.0138-03	\N	calculada	\N	\N
25	7	7	2025-11	0	900000.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2025-11-17 22:55:55.9829-03	\N	calculada	\N	\N
26	9	9	2025-11	0	1200000.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2025-11-17 22:55:55.99043-03	\N	calculada	\N	\N
\.


--
-- Data for Name: salud; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salud (id_salud, nombre, tipo, cotizacion) FROM stdin;
21	Fonasa	fonasa	7.00
22	Isapre Colmena	isapre	7.00
23	Isapre Consalud	isapre	7.00
24	Isapre Banmédica	isapre	7.00
\.


--
-- Data for Name: solicitud_adjuntos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.solicitud_adjuntos (id_adjunto, id_solicitud, nombre_archivo, url_archivo, hash_archivo, creado_en) FROM stdin;
\.


--
-- Data for Name: solicitud_historial; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.solicitud_historial (id_historial, id_solicitud, evento, por_usuario, comentario, creado_en) FROM stdin;
\.


--
-- Data for Name: solicitudes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.solicitudes (id_solicitud, id_empleado, tipo, estado, fecha_desde, fecha_hasta, horas, monto, motivo, detalle, adjuntos_count, fecha_creacion, resuelto_por, fecha_resolucion, comentario_resolucion, creado_en, asunto, mensaje, adjunto_url, actualizado_en) FROM stdin;
2	14	permiso	rechazada	\N	\N	\N	\N	\N	\N	0	2025-11-05 03:42:38.103547-03	1001	2025-11-16 19:47:45.756753-03	No	2025-11-05 03:42:38.103547-03	Medico	s	\N	2025-11-16 19:47:45.756753-03
3	14	vacaciones	rechazada	2025-12-01	2025-12-15	80	0.00	Vacaciones anuales	Solicito mis vacaciones anuales del 1 al 15 de diciembre.	0	2025-11-16 19:09:26.118337-03	1001	2025-11-16 19:44:42.488695-03	No	2025-11-16 19:09:26.118337-03	Solicitud de vacaciones	Hola, quisiera tomar vacaciones entre esas fechas.	\N	2025-11-16 23:45:15.931895-03
6	14	permiso	aprobada	\N	\N	\N	\N	\N	\N	0	2025-11-17 15:59:12.522633-03	1001	2025-11-17 15:59:36.831975-03	Dele nomas	2025-11-17 15:59:12.522633-03	Medico	si	\N	2025-11-17 15:59:36.831975-03
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id_usuario, nombre_usuario, correo, "contraseña", rol) FROM stdin;
1	jperez	juan.perez@empresa.cl	hash	empleado
36	admin	admin@empresa.cl	hash_admin	admin
37	rrhh	rrhh@empresa.cl	hash_rrhh	rrhh
38	jperez	jperez@empresa.cl	hash_jperez	empleado
39	mmartinez	mmartinez@empresa.cl	hash_mmartinez	empleado
40	lrojas	lrojas@empresa.cl	hash_lrojas	empleado
46	Admin	tu@correo.com	admin123	rrhh
1001	Usuario Prueba	usuario@empresa.cl	$2b$10$QheQ9MOGomQhW4gq/6YNqedH6SWrVVTngMjd0OjmHm9G.821M7Q6K	admin
52	Tomás	tomas.bustos.ramos@gmail.com	$2b$10$cpBebWxb8gs0kWhVeBVg7O3f/tLGQqoqsmeLoKYBPgwTOBToyxWw2	empleado
53	cmunoz	carlos.munoz@example.com	$2a$06$W6M4mtG1VtJrLPtoh9aVKOhU4a7a3I.bYXTIYsgQD3vika84Gg2F2	empleado
56	carlos.munoz	carlos2.munoz@example.com	123456	empleado
58	carlos.rojas	carlos3.rojas@example.com	123456	empleado
\.


--
-- Name: afp_id_afp_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.afp_id_afp_seq', 33, true);


--
-- Name: anexos_id_anexos_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.anexos_id_anexos_seq', 10, true);


--
-- Name: anexos_id_contrato_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.anexos_id_contrato_seq', 1, false);


--
-- Name: asistencia_id_asistencia_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asistencia_id_asistencia_seq', 66, true);


--
-- Name: capacitaciones_id_capacitacion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.capacitaciones_id_capacitacion_seq', 15, true);


--
-- Name: contrato_id_contrato_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.contrato_id_contrato_seq', 19, true);


--
-- Name: documentos_generados_id_documento_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documentos_generados_id_documento_seq', 14, true);


--
-- Name: documentos_id_documento_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documentos_id_documento_seq', 1, false);


--
-- Name: empleados_id_empleado_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.empleados_id_empleado_seq', 40, true);


--
-- Name: finiquitos_id_finiquito_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.finiquitos_id_finiquito_seq', 5, true);


--
-- Name: liquidaciones_id_liquidacion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.liquidaciones_id_liquidacion_seq', 28, true);


--
-- Name: salud_id_salud_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.salud_id_salud_seq', 33, true);


--
-- Name: solicitud_adjuntos_id_adjunto_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.solicitud_adjuntos_id_adjunto_seq', 1, false);


--
-- Name: solicitud_historial_id_historial_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.solicitud_historial_id_historial_seq', 1, false);


--
-- Name: solicitudes_id_solicitud_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.solicitudes_id_solicitud_seq', 6, true);


--
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_usuario_seq', 58, true);


--
-- Name: afp afp_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afp
    ADD CONSTRAINT afp_nombre_key UNIQUE (nombre);


--
-- Name: afp afp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.afp
    ADD CONSTRAINT afp_pkey PRIMARY KEY (id_afp);


--
-- Name: anexo anexos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anexo
    ADD CONSTRAINT anexos_pkey PRIMARY KEY (id_anexo);


--
-- Name: asistencia asistencia_empleado_fecha_uk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_empleado_fecha_uk UNIQUE (id_empleado, fecha);


--
-- Name: asistencia asistencia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_pkey PRIMARY KEY (id_asistencia);


--
-- Name: capacitaciones capacitaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capacitaciones
    ADD CONSTRAINT capacitaciones_pkey PRIMARY KEY (id_capacitacion);


--
-- Name: contrato contrato_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contrato
    ADD CONSTRAINT contrato_pkey PRIMARY KEY (id_contrato);


--
-- Name: documentos_generados documentos_generados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_generados
    ADD CONSTRAINT documentos_generados_pkey PRIMARY KEY (id_documento);


--
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (id_documento);


--
-- Name: empleados empleado_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleado_id_usuario_key UNIQUE (id_usuario);


--
-- Name: empleados empleados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_pkey PRIMARY KEY (id_empleado);


--
-- Name: empleados empleados_rut_dv_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_rut_dv_key UNIQUE (rut, digito_verificador);


--
-- Name: feriados_irrenunciables feriados_irrenunciables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feriados_irrenunciables
    ADD CONSTRAINT feriados_irrenunciables_pkey PRIMARY KEY (fecha);


--
-- Name: finiquitos finiquitos_id_contrato_uk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finiquitos
    ADD CONSTRAINT finiquitos_id_contrato_uk UNIQUE (id_contrato);


--
-- Name: finiquitos finiquitos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finiquitos
    ADD CONSTRAINT finiquitos_pkey PRIMARY KEY (id_finiquito);


--
-- Name: liquidaciones liq_empleado_periodo_uk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liq_empleado_periodo_uk UNIQUE (id_empleado, periodo);


--
-- Name: liquidaciones liquidaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_pkey PRIMARY KEY (id_liquidacion);


--
-- Name: salud salud_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salud
    ADD CONSTRAINT salud_nombre_key UNIQUE (nombre);


--
-- Name: salud salud_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salud
    ADD CONSTRAINT salud_pkey PRIMARY KEY (id_salud);


--
-- Name: solicitud_adjuntos solicitud_adjuntos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_adjuntos
    ADD CONSTRAINT solicitud_adjuntos_pkey PRIMARY KEY (id_adjunto);


--
-- Name: solicitud_historial solicitud_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_historial
    ADD CONSTRAINT solicitud_historial_pkey PRIMARY KEY (id_historial);


--
-- Name: solicitudes solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_pkey PRIMARY KEY (id_solicitud);


--
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- Name: anexo_contrato_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX anexo_contrato_fecha_idx ON public.anexo USING btree (id_contrato, fecha);


--
-- Name: anexos_id_contrato_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX anexos_id_contrato_idx ON public.anexo USING btree (id_contrato) WITH (deduplicate_items='true');


--
-- Name: asistencia_empleado_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX asistencia_empleado_fecha_idx ON public.asistencia USING btree (id_empleado, fecha);


--
-- Name: asistencia_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX asistencia_fecha_idx ON public.asistencia USING btree (fecha);


--
-- Name: contrato_empleado_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contrato_empleado_estado_idx ON public.contrato USING btree (id_empleado, estado);


--
-- Name: docgen_empleado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX docgen_empleado_idx ON public.documentos_generados USING btree (id_empleado);


--
-- Name: docgen_tipo_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX docgen_tipo_fecha_idx ON public.documentos_generados USING btree (tipo_documento, generado_en DESC);


--
-- Name: docgen_unq_anexo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX docgen_unq_anexo ON public.documentos_generados USING btree (id_anexo) WHERE (id_anexo IS NOT NULL);


--
-- Name: docgen_unq_contrato; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX docgen_unq_contrato ON public.documentos_generados USING btree (id_contrato) WHERE (id_contrato IS NOT NULL);


--
-- Name: docgen_unq_emp_periodo_liq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX docgen_unq_emp_periodo_liq ON public.documentos_generados USING btree (id_empleado, periodo) WHERE (lower((tipo_documento)::text) = 'liquidacion'::text);


--
-- Name: docgen_unq_finiquito; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX docgen_unq_finiquito ON public.documentos_generados USING btree (id_finiquito) WHERE (id_finiquito IS NOT NULL);


--
-- Name: docgen_unq_liquidacion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX docgen_unq_liquidacion ON public.documentos_generados USING btree (id_liquidacion) WHERE (id_liquidacion IS NOT NULL);


--
-- Name: finiquitos_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX finiquitos_fecha_idx ON public.finiquitos USING btree (fecha_finiquito);


--
-- Name: idx_anexo_id_contrato; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anexo_id_contrato ON public.anexo USING btree (id_contrato);


--
-- Name: idx_asistencia_empleado_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_empleado_fecha ON public.asistencia USING btree (id_empleado, fecha);


--
-- Name: idx_cap_empleado_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cap_empleado_fecha ON public.capacitaciones USING btree (id_empleado, fecha DESC);


--
-- Name: idx_capacitaciones_empleado_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_capacitaciones_empleado_fecha ON public.capacitaciones USING btree (id_empleado, fecha DESC);


--
-- Name: idx_documentos_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documentos_lookup ON public.documentos USING btree (modulo, entidad_id);


--
-- Name: idx_documentos_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documentos_owner ON public.documentos USING btree (id_empleado_owner);


--
-- Name: idx_solicitud_adjuntos_solicitud; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitud_adjuntos_solicitud ON public.solicitud_adjuntos USING btree (id_solicitud);


--
-- Name: idx_solicitud_historial_solicitud; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitud_historial_solicitud ON public.solicitud_historial USING btree (id_solicitud);


--
-- Name: idx_solicitudes_emp_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitudes_emp_fecha ON public.solicitudes USING btree (id_empleado, creado_en DESC);


--
-- Name: idx_solicitudes_empleado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitudes_empleado ON public.solicitudes USING btree (id_empleado);


--
-- Name: idx_solicitudes_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitudes_estado ON public.solicitudes USING btree (estado);


--
-- Name: idx_solicitudes_tipo_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_solicitudes_tipo_estado ON public.solicitudes USING btree (tipo, estado);


--
-- Name: liq_empleado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX liq_empleado_idx ON public.liquidaciones USING btree (id_empleado);


--
-- Name: liq_periodo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX liq_periodo_idx ON public.liquidaciones USING btree (periodo);


--
-- Name: finiquitos finiquito_contrato_upd_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER finiquito_contrato_upd_trg AFTER INSERT ON public.finiquitos FOR EACH ROW EXECUTE FUNCTION public.trg_finiquito_contrato_upd();


--
-- Name: solicitudes tg_solicitudes_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_solicitudes_updated BEFORE UPDATE ON public.solicitudes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: anexo anexo.id_contrato; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anexo
    ADD CONSTRAINT "anexo.id_contrato" FOREIGN KEY (id_contrato) REFERENCES public.contrato(id_contrato) ON DELETE CASCADE NOT VALID;


--
-- Name: anexo anexo_id_contrato_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anexo
    ADD CONSTRAINT anexo_id_contrato_fkey FOREIGN KEY (id_contrato) REFERENCES public.contrato(id_contrato) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: asistencia asistencia_id_empleado_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_id_empleado_fk FOREIGN KEY (id_empleado) REFERENCES public.empleados(id_empleado) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: capacitaciones capacitaciones_id_empleado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capacitaciones
    ADD CONSTRAINT capacitaciones_id_empleado_fkey FOREIGN KEY (id_empleado) REFERENCES public.empleados(id_empleado) ON DELETE CASCADE;


--
-- Name: documentos_generados docgen_anexo_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_generados
    ADD CONSTRAINT docgen_anexo_fk FOREIGN KEY (id_anexo) REFERENCES public.anexo(id_anexo) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: documentos_generados docgen_contrato_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_generados
    ADD CONSTRAINT docgen_contrato_fk FOREIGN KEY (id_contrato) REFERENCES public.contrato(id_contrato) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: documentos_generados docgen_finiquito_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_generados
    ADD CONSTRAINT docgen_finiquito_fk FOREIGN KEY (id_finiquito) REFERENCES public.finiquitos(id_finiquito) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: documentos_generados docgen_liquidacion_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_generados
    ADD CONSTRAINT docgen_liquidacion_fk FOREIGN KEY (id_liquidacion) REFERENCES public.liquidaciones(id_liquidacion) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: empleados empleados_correo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_correo_fkey FOREIGN KEY (correo) REFERENCES public.usuarios(correo) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: empleados empleados_id_afp_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_id_afp_fkey FOREIGN KEY (id_afp) REFERENCES public.afp(id_afp) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: empleados empleados_id_salud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_id_salud_fkey FOREIGN KEY (id_salud) REFERENCES public.salud(id_salud) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: empleados empleados_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: finiquitos finiquitos_id_contrato_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finiquitos
    ADD CONSTRAINT finiquitos_id_contrato_fk FOREIGN KEY (id_contrato) REFERENCES public.contrato(id_contrato) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: liquidaciones liq_contrato_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liq_contrato_fk FOREIGN KEY (id_contrato) REFERENCES public.contrato(id_contrato) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: solicitud_adjuntos solicitud_adjuntos_id_solicitud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_adjuntos
    ADD CONSTRAINT solicitud_adjuntos_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes(id_solicitud) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: solicitud_historial solicitud_historial_id_solicitud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_historial
    ADD CONSTRAINT solicitud_historial_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes(id_solicitud) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: solicitud_historial solicitud_historial_por_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitud_historial
    ADD CONSTRAINT solicitud_historial_por_usuario_fkey FOREIGN KEY (por_usuario) REFERENCES public.usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: solicitudes solicitudes_id_empleado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_id_empleado_fkey FOREIGN KEY (id_empleado) REFERENCES public.empleados(id_empleado) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: solicitudes solicitudes_resuelto_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES public.usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict deO1YDE9KyqgBbcZixENwTheAvXCluPW4qazRHuzhChdk1dP5bFkT5MKbYVqiJm

