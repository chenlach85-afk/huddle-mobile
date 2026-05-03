import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { format as dateFnsFormat, parseISO } from "date-fns";
import { he, enUS, es } from "date-fns/locale";

export type Language = "en" | "he" | "es";

const LOCALE_MAP = { he, en: enUS, es };

const translations = {
  en: {
    nav: {
      huddle: "Dashboard",
      squads: "Squads",
      calendar: "Calendar",
      settings: "Settings",
    },
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      loading: "Loading...",
      error: "Something went wrong",
      success: "Success",
      confirm: "Confirm",
      back: "Back",
      add: "Add",
      create: "Create",
      update: "Update",
      search: "Search",
      filter: "Filter",
      noData: "No data found",
      signOut: "Sign Out",
      coachMode: "Coach Mode",
      allSquads: "All Squads",
    },
    auth: {
      signIn: "Sign In",
      signUp: "Sign Up",
      welcome: "Welcome to TeamHub",
      tagline: "Professional team management for coaches",
      getStarted: "Get Started",
      alreadyHaveAccount: "Already have an account?",
      noAccount: "Don't have an account?",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Your coaching command center",
      totalTeams: "Total Teams",
      totalPlayers: "Total Players",
      upcomingEvents: "Upcoming Events",
      activeTasks: "Active Tasks",
      squads: "Squads",
      lineup: "Lineup",
      openTasks: "Open Tasks",
      athletes: "Athletes",
      squadBreakdown: "Squad Breakdown",
      allSquads: "All Squads",
      createFirstSquad: "Create your first squad",
      manageSquads: "Manage Squads",
      manageSquadsDesc: "Rosters, schedules, tasks, messages",
      games: "Games",
      tasks: "Tasks",
      noSquadsYet: "No squads yet",
    },
    teams: {
      title: "Squads",
      subtitle: "Manage your teams",
      createTeam: "Create Team",
      noTeams: "No teams yet",
      players: "Players",
      editTeam: "Edit Team",
      deleteTeam: "Delete Team",
      joinCode: "Join Code",
      teamName: "Team Name",
      sport: "Sport",
      season: "Season",
      coachName: "Coach Name",
      description: "Description",
    },
    calendar: {
      title: "Calendar",
      schedule: "Schedule",
      today: "Today",
      upcoming: "Upcoming",
      noEvents: "No events this day",
      noUpcoming: "No upcoming events",
      addEvent: "Add Event",
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      eventTypes: {
        practice: "Practice",
        game: "Game",
        meeting: "Meeting",
        other: "Other",
      },
      until: "Until",
    },
    settings: {
      title: "Settings",
      profile: "Profile",
      language: "Language",
      notifications: "Notifications",
      security: "Security",
      changePassword: "Change Password",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      notificationsEnabled: "Enable Notifications",
      emailNotifications: "Email Notifications",
      pushNotifications: "Push Notifications",
      calendarReminder: "Calendar Reminder",
      reminderBefore: "Remind me before events",
      mins15: "15 minutes",
      mins30: "30 minutes",
      hour1: "1 hour",
      day1: "1 day",
      languageChanged: "Language updated",
      settingsSaved: "Settings saved",
      signOutConfirm: "Are you sure you want to sign out?",
    },
    notifications: {
      title: "Notifications",
      markAllRead: "Mark all as read",
      noNotifications: "No notifications",
      newTask: "New task assigned",
      newEvent: "New event scheduled",
      newMessage: "New message",
    },
    files: {
      upload: "Upload File",
      uploading: "Uploading...",
      selectFile: "Select a file",
      dragDrop: "or drag and drop",
      maxSize: "Max file size: 10MB",
      images: "Images",
      videos: "Videos",
      documents: "Documents",
    },
  },
  he: {
    nav: {
      huddle: "ראשי",
      squads: "קבוצות",
      calendar: "לו\"ז",
      settings: "הגדרות",
    },
    common: {
      save: "שמור",
      cancel: "ביטול",
      delete: "מחק",
      edit: "ערוך",
      close: "סגור",
      loading: "טוען...",
      error: "שגיאה",
      success: "הצלחה",
      confirm: "אישור",
      back: "חזרה",
      add: "הוסף",
      create: "צור",
      update: "עדכן",
      search: "חיפוש",
      filter: "סינון",
      noData: "לא נמצאו נתונים",
      signOut: "התנתק",
      coachMode: "מצב מאמן",
      allSquads: "כל הקבוצות",
    },
    auth: {
      signIn: "התחברות",
      signUp: "הרשמה",
      welcome: "ברוכים הבאים ל-TeamHub",
      tagline: "ניהול קבוצות מקצועי למאמנים",
      getStarted: "בואו נתחיל",
      alreadyHaveAccount: "כבר רשום?",
      noAccount: "עדיין לא רשום?",
    },
    dashboard: {
      title: "ראשי",
      subtitle: "מרכז הפיקוד שלך",
      totalTeams: "קבוצות",
      totalPlayers: "שחקנים",
      upcomingEvents: "אירועים קרובים",
      activeTasks: "משימות פתוחות",
      squads: "קבוצות",
      lineup: "לו\"ז",
      openTasks: "משימות",
      athletes: "שחקנים",
      squadBreakdown: "סקירת קבוצות",
      allSquads: "כל הקבוצות",
      createFirstSquad: "צור את הקבוצה הראשונה שלך",
      manageSquads: "ניהול קבוצות",
      manageSquadsDesc: "סגל, לו\"ז, משימות, הודעות",
      games: "משחקים",
      tasks: "משימות",
      noSquadsYet: "אין קבוצות עדיין",
    },
    teams: {
      title: "קבוצות",
      subtitle: "נהל את הקבוצות שלך",
      createTeam: "צור קבוצה",
      noTeams: "אין קבוצות עדיין",
      players: "שחקנים",
      editTeam: "ערוך קבוצה",
      deleteTeam: "מחק קבוצה",
      joinCode: "קוד הצטרפות",
      teamName: "שם הקבוצה",
      sport: "ענף ספורט",
      season: "עונה",
      coachName: "שם המאמן",
      description: "תיאור",
    },
    calendar: {
      title: "לוח שנה",
      schedule: "לו\"ז",
      today: "היום",
      upcoming: "קרובים",
      noEvents: "אין אימונים/משחקים ביום זה",
      noUpcoming: "אין אירועים קרובים",
      addEvent: "הוסף אירוע",
      weekdays: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
      eventTypes: {
        practice: "אימון",
        game: "משחק",
        meeting: "פגישה",
        other: "אחר",
      },
      until: "עד",
    },
    settings: {
      title: "הגדרות",
      profile: "פרופיל",
      language: "שפה",
      notifications: "התראות",
      security: "אבטחה",
      changePassword: "שנה סיסמה",
      currentPassword: "סיסמה נוכחית",
      newPassword: "סיסמה חדשה",
      confirmPassword: "אשר סיסמה",
      notificationsEnabled: "הפעל התראות",
      emailNotifications: "התראות מייל",
      pushNotifications: "התראות פוש",
      calendarReminder: "תזכורת ללו\"ז",
      reminderBefore: "הזכר לי לפני אירועים",
      mins15: "רבע שעה",
      mins30: "חצי שעה",
      hour1: "שעה",
      day1: "יום",
      languageChanged: "השפה עודכנה",
      settingsSaved: "ההגדרות נשמרו",
      signOutConfirm: "בטוח שרוצה להתנתק?",
    },
    notifications: {
      title: "התראות",
      markAllRead: "סמן הכל כנקרא",
      noNotifications: "אין התראות",
      newTask: "משימה חדשה הוקצתה",
      newEvent: "אירוע חדש בלו\"ז",
      newMessage: "הודעה חדשה",
    },
    files: {
      upload: "העלאת קובץ",
      uploading: "מעלה...",
      selectFile: "בחר קובץ",
      dragDrop: "או גרור לכאן",
      maxSize: "גודל מקסימלי: 10MB",
      images: "תמונות",
      videos: "סרטונים",
      documents: "מסמכים",
    },
  },
  es: {
    nav: {
      huddle: "Inicio",
      squads: "Equipos",
      calendar: "Calendario",
      settings: "Configuración",
    },
    common: {
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      close: "Cerrar",
      loading: "Cargando...",
      error: "Algo salió mal",
      success: "Éxito",
      confirm: "Confirmar",
      back: "Volver",
      add: "Agregar",
      create: "Crear",
      update: "Actualizar",
      search: "Buscar",
      filter: "Filtrar",
      noData: "No se encontraron datos",
      signOut: "Cerrar sesión",
      coachMode: "Modo Entrenador",
      allSquads: "Todos los equipos",
    },
    auth: {
      signIn: "Iniciar sesión",
      signUp: "Registrarse",
      welcome: "Bienvenido a TeamHub",
      tagline: "Gestión profesional de plantillas para entrenadores",
      getStarted: "Comenzar",
      alreadyHaveAccount: "¿Ya tienes cuenta?",
      noAccount: "¿No tienes cuenta?",
    },
    dashboard: {
      title: "Inicio",
      subtitle: "Tu centro de comando",
      totalTeams: "Equipos",
      totalPlayers: "Jugadores",
      upcomingEvents: "Próximos partidos",
      activeTasks: "Tareas activas",
      squads: "Plantillas",
      lineup: "Agenda",
      openTasks: "Tareas",
      athletes: "Jugadores",
      squadBreakdown: "Resumen de equipos",
      allSquads: "Todos los equipos",
      createFirstSquad: "Crea tu primer equipo",
      manageSquads: "Gestionar equipos",
      manageSquadsDesc: "Plantillas, calendario, tareas, mensajes",
      games: "Partidos",
      tasks: "Tareas",
      noSquadsYet: "Sin equipos todavía",
    },
    teams: {
      title: "Equipos",
      subtitle: "Gestiona tus equipos",
      createTeam: "Crear Equipo",
      noTeams: "Sin equipos todavía",
      players: "Jugadores",
      editTeam: "Editar Equipo",
      deleteTeam: "Eliminar Equipo",
      joinCode: "Código de acceso",
      teamName: "Nombre del equipo",
      sport: "Deporte",
      season: "Temporada",
      coachName: "Nombre del entrenador",
      description: "Descripción",
    },
    calendar: {
      title: "Calendario",
      schedule: "Agenda",
      today: "Hoy",
      upcoming: "Próximos",
      noEvents: "Sin eventos este día",
      noUpcoming: "Sin próximos eventos",
      addEvent: "Agregar evento",
      weekdays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      eventTypes: {
        practice: "Entrenamiento",
        game: "Partido",
        meeting: "Reunión",
        other: "Otro",
      },
      until: "Hasta",
    },
    settings: {
      title: "Configuración",
      profile: "Perfil",
      language: "Idioma",
      notifications: "Notificaciones",
      security: "Seguridad",
      changePassword: "Cambiar contraseña",
      currentPassword: "Contraseña actual",
      newPassword: "Nueva contraseña",
      confirmPassword: "Confirmar contraseña",
      notificationsEnabled: "Activar notificaciones",
      emailNotifications: "Notificaciones por email",
      pushNotifications: "Notificaciones push",
      calendarReminder: "Recordatorio de calendario",
      reminderBefore: "Avisarme antes de los eventos",
      mins15: "15 minutos",
      mins30: "30 minutos",
      hour1: "1 hora",
      day1: "1 día",
      languageChanged: "Idioma actualizado",
      settingsSaved: "Configuración guardada",
      signOutConfirm: "¿Seguro que quieres cerrar sesión?",
    },
    notifications: {
      title: "Notificaciones",
      markAllRead: "Marcar todo como leído",
      noNotifications: "Sin notificaciones",
      newTask: "Nueva tarea asignada",
      newEvent: "Nuevo evento programado",
      newMessage: "Nuevo mensaje",
    },
    files: {
      upload: "Subir archivo",
      uploading: "Subiendo...",
      selectFile: "Seleccionar archivo",
      dragDrop: "o arrastra y suelta",
      maxSize: "Tamaño máximo: 10MB",
      images: "Imágenes",
      videos: "Videos",
      documents: "Documentos",
    },
  },
};

export type Translations = typeof translations.en;

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRTL: boolean;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  formatDateTime: (date: Date | string) => string;
  formatDayOfWeek: (date: Date | string, style?: "short" | "letter") => string;
  formatMonthYear: (date: Date | string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const RTL_LANGUAGES: Language[] = ["he"];

function detectBrowserLanguage(): Language {
  const nav = navigator.language || "";
  if (nav.startsWith("he")) return "he";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("teamhub-lang") as Language | null;
    if (stored && ["en", "he", "es"].includes(stored)) return stored;
    return detectBrowserLanguage();
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("teamhub-lang", lang);
  }, []);

  const isRTL = RTL_LANGUAGES.includes(language);

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const locale = LOCALE_MAP[language];

  const formatDate = useCallback((date: Date | string): string => {
    const d = typeof date === "string" ? parseISO(date) : date;
    if (language === "en") return dateFnsFormat(d, "M/d/yyyy", { locale });
    return dateFnsFormat(d, "dd/MM/yyyy", { locale });
  }, [language, locale]);

  const formatTime = useCallback((date: Date | string): string => {
    const d = typeof date === "string" ? parseISO(date) : date;
    if (language === "en") return dateFnsFormat(d, "h:mm a", { locale });
    return dateFnsFormat(d, "HH:mm", { locale });
  }, [language, locale]);

  const formatDateTime = useCallback((date: Date | string): string => {
    const d = typeof date === "string" ? parseISO(date) : date;
    if (language === "en") return dateFnsFormat(d, "EEE, MMM d · h:mm a", { locale });
    if (language === "he") return dateFnsFormat(d, "EEE, dd/MM · HH:mm", { locale });
    return dateFnsFormat(d, "EEE, dd/MM · HH:mm", { locale });
  }, [language, locale]);

  const formatDayOfWeek = useCallback((date: Date | string, style: "short" | "letter" = "short"): string => {
    const d = typeof date === "string" ? parseISO(date) : date;
    if (style === "letter" && language === "he") {
      return dateFnsFormat(d, "EEEEEE", { locale: he });
    }
    return dateFnsFormat(d, "EEE", { locale });
  }, [language, locale]);

  const formatMonthYear = useCallback((date: Date | string): string => {
    const d = typeof date === "string" ? parseISO(date) : date;
    return dateFnsFormat(d, "MMMM yyyy", { locale });
  }, [language, locale]);

  const t = translations[language] as Translations;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isRTL, formatDate, formatTime, formatDateTime, formatDayOfWeek, formatMonthYear }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
