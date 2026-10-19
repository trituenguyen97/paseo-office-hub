import type { PluginServerContext } from "@getpaseo/plugin/server";
import { openOutlook } from "./server/calopen";
import * as alerts from "./server/alerts";
import * as notes from "./server/notes";
import * as outlook from "./server/outlook";
import * as outlookCheck from "./server/outlookcheck";
import { fetchWcStatus } from "./server/wc";
import { alertAck, alertList } from "./shared/alerts";
import { calToday, mailToday, outlookOpen } from "./shared/cal";
import { notesList, notesUpdate } from "./shared/notes";
import { outlookCheck as outlookCheckRpc, outlookConnect } from "./shared/outlookcheck";
import { officeSettings, withDefaults } from "./shared/settings";
import { wcStatus } from "./shared/wc";

export default function contribute(server: PluginServerContext) {
  // Follow the chosen Outlook source: read the saved value now, then on every change.
  const settings = server.registerSettings(officeSettings);
  const apply = (state: Awaited<ReturnType<typeof settings.read>>) => {
    if (state.status === "ready") outlook.setOutlookSource(withDefaults(state.values).outlookSource);
  };
  void settings.read().then(apply, () => undefined);
  const stopSettings = settings.subscribe(apply);

  server.handle(wcStatus, fetchWcStatus);
  server.handle(calToday, outlook.calendarToday);
  server.handle(mailToday, outlook.mailTodayList);
  server.handle(outlookOpen, openOutlook);
  server.handle(outlookCheckRpc, outlookCheck.check);
  server.handle(outlookConnect, outlookCheck.connect);
  server.handle(alertList, alerts.list);
  server.handle(alertAck, alerts.ack);
  server.handle(notesList, notes.list);
  server.handle(notesUpdate, notes.update);
  return () => {
    stopSettings();
  };
}
