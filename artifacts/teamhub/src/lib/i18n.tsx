import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Language = "en" | "he" | "es";

const translations = {
  en: {
    nav: {
      huddle: "Huddle",
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
      title: "Huddle",
      subtitle: "Your coaching command center",
      totalTeams: "Total Teams",
      totalPlayers: "Total Players",
      upcomingEvents: "Upcoming Events",
      activeTasks: "Active Tasks",
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
      today: "Today",
      upcoming: "Upcoming",
      noEvents: "No events this day",
      addEvent: "Add Event",
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
      huddle: "לוח ראשי",
      squads: "קבוצות",
      calendar: "לוח שנה",
      settings: "הגדרות",
    },
    common: {
      save: "שמור",
      cancel: "בטל",
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
    },
    auth: {
      signIn: "התחברות",
      signUp: "הרשמה",
      welcome: "ברוכים הבאים לTeamHub",
      tagline: "ניהול קבוצות מקצועי למאמנים",
      getStarted: "התחל עכשיו",
      alreadyHaveAccount: "כבר יש לך חשבון?",
      noAccount: "אין לך חשבון?",
    },
    dashboard: {
      title: "לוח ראשי",
      subtitle: "מרכז הפיקוד שלך",
      totalTeams: "סה״כ קבוצות",
      totalPlayers: "סה״כ שחקנים",
      upcomingEvents: "אירועים קרובים",
      activeTasks: "משימות פעילות",
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
      today: "היום",
      upcoming: "קרובים",
      noEvents: "אין אירועים ביום זה",
      addEvent: "הוסף אירוע",
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
      emailNotifications: "התראות אימייל",
      pushNotifications: "התראות דחיפה",
      calendarReminder: "תזכורת לוח שנה",
      reminderBefore: "הזכר לי לפני אירועים",
      mins15: "15 דקות",
      mins30: "30 דקות",
      hour1: "שעה",
      day1: "יום",
      languageChanged: "השפה עודכנה",
      settingsSaved: "ההגדרות נשמרו",
      signOutConfirm: "האם אתה בטוח שברצונך להתנתק?",
    },
    notifications: {
      title: "התראות",
      markAllRead: "סמן הכל כנקרא",
      noNotifications: "אין התראות",
      newTask: "משימה חדשה הוקצתה",
      newEvent: "אירוע חדש נקבע",
      newMessage: "הודעה חדשה",
    },
    files: {
      upload: "העלה קובץ",
      uploading: "מעלה...",
      selectFile: "בחר קובץ",
      dragDrop: "או גרור ושחרר",
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
    },
    auth: {
      signIn: "Iniciar sesión",
      signUp: "Registrarse",
      welcome: "Bienvenido a TeamHub",
      tagline: "Gestión profesional de equipos para entrenadores",
      getStarted: "Comenzar",
      alreadyHaveAccount: "¿Ya tienes una cuenta?",
      noAccount: "¿No tienes una cuenta?",
    },
    dashboard: {
      title: "Inicio",
      subtitle: "Tu centro de comando de entrenamiento",
      totalTeams: "Total de Equipos",
      totalPlayers: "Total de Jugadores",
      upcomingEvents: "Próximos Eventos",
      activeTasks: "Tareas Activas",
    },
    teams: {
      title: "Equipos",
      subtitle: "Gestiona tus equipos",
      createTeam: "Crear Equipo",
      noTeams: "Sin equipos todavía",
      players: "Jugadores",
      editTeam: "Editar Equipo",
      deleteTeam: "Eliminar Equipo",
      joinCode: "Código de unión",
      teamName: "Nombre del equipo",
      sport: "Deporte",
      season: "Temporada",
      coachName: "Nombre del entrenador",
      description: "Descripción",
    },
    calendar: {
      title: "Calendario",
      today: "Hoy",
      upcoming: "Próximos",
      noEvents: "Sin eventos este día",
      addEvent: "Agregar Evento",
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
      reminderBefore: "Recordarme antes de los eventos",
      mins15: "15 minutos",
      mins30: "30 minutos",
      hour1: "1 hora",
      day1: "1 día",
      languageChanged: "Idioma actualizado",
      settingsSaved: "Configuración guardada",
      signOutConfirm: "¿Estás seguro de que quieres cerrar sesión?",
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
}

const I18nContext = createContext<I18nContextValue | null>(null);

const RTL_LANGUAGES: Language[] = ["he"];

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("teamhub-lang") as Language) || "en";
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

  const t = translations[language] as Translations;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
