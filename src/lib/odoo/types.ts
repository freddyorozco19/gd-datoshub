export interface OdooAttachment {
  id:        number;
  name:      string;
  mimetype:  string;
  file_size: number;
}

// Respuesta cruda de ODOO (many2one = [id, nombre] | false)
export interface OdooLead {
  id: number;
  active: boolean;
  name: string;
  email_from: string | false;
  phone: string | false;
  partner_id: [number, string] | false;
  user_id: [number, string] | false;
  x_studio_linea: string | false;
  stage_id: [number, string] | false;
  team_id: [number, string] | false;
  x_studio_tipo_de_oportunidad: string | false;
  x_studio_fabricante_otro: string | false;
  x_studio_edopreventa: string | false;
  x_studio_preventa: [number, string] | false;
  create_date: string;
  expected_revenue: number;
  x_studio_consultoria_cop: number | false;
  x_studio_datos_cop: number | false;
  x_studio_ti_cop: number | false;
  x_studio_alcance: string | false;
  x_studio_objeto: string | false;
  date_deadline: string | false;
  x_studio_fecha_efectiva_de_cierre: string | false;
  date_closed: string | false;
  write_date: string;
  x_studio_tipo_de_producto: string | false;
  x_studio_proyecto: string | false;
  won_status: "won" | "lost" | false;
}

// Modelo normalizado para el frontend
export interface Lead {
  id: number;
  activo: boolean;
  nombre: string;
  correo: string;
  telefono: string;
  cliente: string;
  comercial: string;
  linea: string;
  etapa: string;
  equipoVentas: string;
  tipoOportunidad: string;
  fabricante: string;
  etapaPreventa: string;
  preventa: string;
  fechaCreacion: string;
  ingresosEsperados: number;
  consultoriaCOP: number;
  datosCOP: number;
  tiCOP: number;
  alcance: string;
  objeto: string;
  cierreEsperado: string;
  fechaEfectivaCierre: string;
  fechaCierre: string;
  ultimaModificacion: string;   // write_date ajustado GMT-5
  tipoCliente: string;
  tipoVenta:   string;
  ganado:      string;
  adjuntos:    number;
}
