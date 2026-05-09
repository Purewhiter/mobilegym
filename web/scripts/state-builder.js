(function () {
  const frame = document.getElementById('demo-frame');
  const bootBtnHTML = frame.innerHTML;
  const offBtn = document.getElementById('demo-poweroff-btn');
  const studioStatus = document.getElementById('studio-status');
  const studioTabs = Array.from(document.querySelectorAll('[data-studio-tab]'));
  const studioPanels = Array.from(document.querySelectorAll('[data-studio-panel]'));
  const studioActionTabs = Array.from(document.querySelectorAll('[data-studio-action]'));
  const studioActionPanels = Array.from(document.querySelectorAll('[data-studio-action-panel]'));
  const languageChoices = Array.from(document.querySelectorAll('[data-language-choice]'));
  const SNAPSHOT_STORAGE_KEY = 'mobilegym_demo_snapshots_v1';
  const LOCALE_STORAGE_KEY = 'mobilegym_demo_locale_v1';
  const MAX_SNAPSHOTS = 8;

  function $(id) {
    return document.getElementById(id);
  }

  function setStudioStatus(message, kind) {
    studioStatus.textContent = message;
    studioStatus.dataset.kind = kind || 'warn';
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cleanText(value, fallback, maxLen) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    return (text || fallback).slice(0, maxLen || 120);
  }

  function wechatAsset(value) {
    const path = cleanText(value, 'avatars/avatar_default.jpg', 120);
    if (path.startsWith('http') || path.startsWith('/@app-assets/')) return path;
    return `/@app-assets/Wechat/${path.replace(/^\/+/, '')}`;
  }

  function money(value, fallback) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.round(parsed * 100) / 100;
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  }

  function getDemoIframe() {
    return frame.querySelector('iframe');
  }

  function getDemoWindow() {
    const iframe = getDemoIframe();
    if (!iframe) return null;
    try {
      return iframe.contentWindow;
    } catch {
      return null;
    }
  }

  function getStateTime(state) {
    const ts = Number(state?.os?.time?.timestamp);
    return Number.isFinite(ts) ? ts : Date.now();
  }

  function toLocalDatetimeInput(timestamp) {
    const date = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function toShortTime(timestamp) {
    const date = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function cloneJSON(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readSnapshots() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter((item) => item?.id && item?.state)
        : [];
    } catch {
      return [];
    }
  }

  function writeSnapshots(snapshots) {
    const compacted = compactSnapshotsForStorage(snapshots);
    let lastError = null;
    for (let count = compacted.length; count >= 1; count -= 1) {
      try {
        localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(compacted.slice(0, count)));
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Could not save snapshots.');
  }

  function compactRedBookState(redbook) {
    if (!redbook || typeof redbook !== 'object') return redbook;
    const compact = { ...redbook };
    delete compact.entities;
    delete compact.feedIds;
    delete compact.userIds;
    return compact;
  }

  function compactSnapshotState(state) {
    const compact = cloneJSON(state || {});
    if (compact.apps?.redbook) {
      compact.apps.redbook = compactRedBookState(compact.apps.redbook);
    }
    return compact;
  }

  function compactSnapshotsForStorage(snapshots) {
    return snapshots.slice(0, MAX_SNAPSHOTS).map((item) => ({
      ...item,
      state: compactSnapshotState(item.state),
    }));
  }

  function refreshSnapshotSelect(selectedId) {
    const select = $('studio-snapshot-select');
    const snapshots = readSnapshots();
    if (!snapshots.length) {
      select.innerHTML = '<option value="">No snapshots yet</option>';
      return;
    }
    select.innerHTML = snapshots.map((item) => {
      const created = Number.isFinite(Number(item.createdAt)) ? toShortTime(Number(item.createdAt)) : '--:--';
      return `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name || 'Snapshot')} · ${created}</option>`;
    }).join('');
    if (selectedId && snapshots.some((item) => item.id === selectedId)) {
      select.value = selectedId;
    }
  }

  function applySnapshotTime(win, snapshot) {
    const api = win.__SIM_TIME__;
    const cfg = snapshot?.timeConfig;
    if (!api || !cfg) return;
    if (cfg.mode === 'real') {
      api.setRealTime?.();
      api.setSpeed?.(1);
      return;
    }
    const fallback = getStateTime(snapshot.state);
    api.setSimulatedTime?.(cfg.simulatedTime || fallback, cfg.flowing !== false);
    api.setSpeed?.(cfg.flowing === false ? 1 : Number(cfg.speed) || 1);
  }

  function applySnapshotLocation(win, snapshot) {
    const api = win.__SIM_LOCATION__;
    const cfg = snapshot?.locationConfig;
    if (!api || !cfg) return;
    if (cfg.mode === 'real') {
      api.setRealLocation?.();
      return;
    }
    if (cfg.simulatedLocation) {
      api.setSimulatedLocation?.(cfg.simulatedLocation);
      return;
    }
    if (snapshot.locationCoords) {
      api.setSimulatedLocation?.(snapshot.locationCoords);
    }
  }

  function isHydratedRedBookSnapshot(redbook) {
    const notesById = redbook?.entities?.notesById;
    return Boolean(
      redbook &&
      notesById &&
      typeof notesById === 'object' &&
      Object.keys(notesById).length > 0 &&
      Array.isArray(redbook.feedIds) &&
      redbook.feedIds.length > 0,
    );
  }

  async function waitForSnapshotData(win) {
    if (!win.__SIM__?.waitForData) return;
    try {
      await win.__SIM__.waitForData(['redbook']);
    } catch {
      // 数据加载失败时仍允许保存当前状态；状态栏会提示后续 restore 的实际结果。
    }
  }

  function readLocalDatetimeInput(id, fallbackTs) {
    const raw = String($(id).value || '').trim();
    if (!raw) return fallbackTs;
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : fallbackTs;
  }

  function setDeviceTimeFlowOptions(mode, value) {
    const select = $('studio-device-time-flow');
    $('studio-device-time-value-field').hidden = mode !== 'simulated';
    const options = mode === 'real'
      ? [{ value: 'flow', label: 'Flow' }]
      : [
          { value: 'paused', label: 'Paused' },
          { value: '1', label: '1x' },
          { value: '10', label: '10x' },
          { value: '100', label: '100x' },
        ];
    select.innerHTML = options
      .map((item) => `<option value="${item.value}">${item.label}</option>`)
      .join('');
    select.value = options.some((item) => item.value === value)
      ? value
      : mode === 'real'
        ? 'flow'
        : '1';
  }

  function syncLocationCustomVisibility() {
    $('studio-device-location-custom').hidden = $('studio-device-location-preset').value !== 'custom';
  }

  function selectedWechatAvatar() {
    const active = document.querySelector('#studio-wechat-avatar-picker .avatar-choice[aria-pressed="true"]');
    return active?.dataset?.avatar || 'avatars/avatar_default.jpg';
  }

  function waitForSimulator(timeoutMs) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        const win = getDemoWindow();
        if (win?.__SIM__?.getState && win?.__SIM__?.setState && win?.__OS__) {
          resolve(win);
          return;
        }
        if (Date.now() - startedAt > (timeoutMs || 12000)) {
          reject(new Error('Simulator is not ready yet.'));
          return;
        }
        window.setTimeout(tick, 120);
      };
      tick();
    });
  }

  async function withSimulator(action) {
    try {
      const win = await waitForSimulator();
      return await action(win, win.__SIM__.getState());
    } catch (error) {
      setStudioStatus(error?.message || 'Power on the phone first.', 'error');
      throw error;
    }
  }

  function syncStudioFromState() {
    const win = getDemoWindow();
    if (!win?.__SIM__?.getState) return;
    const state = win.__SIM__.getState();
    const timeApi = win.__SIM_TIME__;
    if (timeApi?.getConfig) {
      const cfg = timeApi.getConfig();
      const mode = cfg.mode === 'simulated' ? 'simulated' : 'real';
      $('studio-device-time-mode').value = mode;
      const flow = mode === 'real'
        ? 'flow'
        : cfg.flowing === false
          ? 'paused'
          : Number(cfg.speed) >= 100
            ? '100'
            : Number(cfg.speed) >= 10
              ? '10'
              : '1';
      setDeviceTimeFlowOptions(mode, flow);
      if (!$('studio-device-time-value').value) {
        $('studio-device-time-value').value = toLocalDatetimeInput(timeApi.now ? timeApi.now() : getStateTime(state));
      }
    }
    const battery = state?.os?.hardware?.battery;
    if (battery && typeof battery === 'object') {
      $('studio-device-battery-level').value = String(
        clampNumber(battery.percent, 0, 100, 80),
      );
      $('studio-device-battery-status').value = battery.fastCharging
        ? 'fast'
        : battery.charging
          ? 'charging'
          : 'unplugged';
    }
    const batterySaver = state?.os?.settings?.global?.batterySaverEnabled;
    if (typeof batterySaver === 'boolean') {
      $('studio-device-battery-saver').value = batterySaver ? 'on' : 'off';
    }
    const locationApi = win.__SIM_LOCATION__;
    if (locationApi?.getConfig) {
      const coords = locationApi.getCoords?.();
      if (coords) {
        $('studio-device-location-lat').value = String(coords.latitude);
        $('studio-device-location-lon').value = String(coords.longitude);
      }
      syncLocationCustomVisibility();
    }
    const wechat = state?.apps?.wechat || {};
    const contacts = Array.isArray(wechat.contacts) ? wechat.contacts : [];
    const select = $('studio-wechat-contact');
    const current = select.value;
    const options = contacts
      .filter((item) => item?.wxid && item?.name)
      .map((item) => ({
        wxid: String(item.wxid),
        name: String(item.name),
      }));
    select.innerHTML = options.length
      ? options.map((item) => `<option value="${item.wxid.replace(/"/g, '&quot;')}">${item.name}</option>`).join('')
      : '<option value="">陈静</option>';
    if (current && options.some((item) => item.wxid === current)) select.value = current;
    else {
      const chenJing = options.find((item) => item.name === '陈静');
      if (chenJing) select.value = chenJing.wxid;
    }
    if (!$('studio-wechat-time').value) {
      $('studio-wechat-time').value = toLocalDatetimeInput(getStateTime(state));
    }
  }

  function switchStudioTab(name) {
    studioTabs.forEach((tab) => {
      tab.setAttribute('aria-selected', tab.dataset.studioTab === name ? 'true' : 'false');
    });
    studioPanels.forEach((panel) => {
      panel.dataset.active = panel.dataset.studioPanel === name ? 'true' : 'false';
    });
    const activePanel = studioPanels.find((panel) => panel.dataset.studioPanel === name);
    const firstAction = activePanel?.querySelector('[data-studio-action]')?.dataset?.studioAction;
    if (firstAction) switchStudioAction(firstAction);
    const labels = {
      session: 'Reset, save, or restore simulator snapshots in this browser.',
      language: 'Switch the simulated phone language. Resets per-app overrides.',
      device: 'Choose time, battery, or location for the simulated device.',
      wechat: 'Choose message or contact data for WeChat.',
      alipay: 'Choose balance or bill data for Alipay.',
      sms: 'Choose contact or incoming SMS data.',
      railway: 'Add a train ticket/order for 12306.',
    };
    setStudioStatus(labels[name] || 'Pick a scenario to apply.', 'warn');
  }

  function switchStudioAction(name) {
    studioActionTabs.forEach((tab) => {
      tab.setAttribute('aria-selected', tab.dataset.studioAction === name ? 'true' : 'false');
    });
    studioActionPanels.forEach((panel) => {
      panel.dataset.active = panel.dataset.studioActionPanel === name ? 'true' : 'false';
    });
  }

  // ============================================================
  // Phone language toggle
  // - Switches OS-level locale (settings.global.language) AND
  //   resets per-app language overrides for the four apps with
  //   their own override layer (Alipay / Bilibili / RedBook / Map).
  // - Without resetting overrides, those apps stay Chinese even
  //   when the OS is flipped to English (their defaults are
  //   non-null Chinese values that override the system locale).
  // - Persisted in localStorage so the choice survives reloads
  //   and is re-applied each time the simulator boots.
  // ============================================================
  // Returns 'en' / 'zh-Hans' for an explicit user choice, or null when the
  // visitor has never picked a language. The distinction matters: on first
  // boot we must NOT push any patch, otherwise we'd overwrite each app's
  // natural default (Map's null=follow-OS, Alipay's 'zh-CN', etc.) with a
  // generic 'zh' override.
  function readStoredLocale() {
    try {
      const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (raw === 'en' || raw === 'zh-Hans') return raw;
      return null;
    } catch {
      return null;
    }
  }

  function writeStoredLocale(locale) {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch { /* private mode */ }
  }

  function updateLanguageUI(locale) {
    const display = locale || 'zh-Hans';
    const badge = $('state-dock-language-badge');
    if (badge) badge.textContent = display === 'en' ? 'EN' : '中';
    languageChoices.forEach((btn) => {
      btn.setAttribute('aria-checked', btn.dataset.languageChoice === display ? 'true' : 'false');
    });
  }

  function buildLocaleAppPatch(locale) {
    if (locale === 'en') {
      return {
        alipay: { language: 'en' },
        bilibili: { settings: { language: 'en' } },
        redbook: { settings: { language: 'en-US' } },
        map: { settings: { appDisplay: { language: 'en' } } },
      };
    }
    // zh-Hans → write explicit Chinese values. Can't use null here:
    // __SIM__.setState's deepMerge treats null as "no change" (see
    // os/OSContext.tsx deepMerge), so a null patch can never clear an
    // existing 'en' override. Each app's resolve*Locale falls back to
    // 'zh-Hans' for anything that isn't the explicit 'en' / 'en-US'
    // marker, so writing 'zh' / 'zh-CN' is safe.
    return {
      alipay: { language: 'zh' },
      bilibili: { settings: { language: 'zh' } },
      redbook: { settings: { language: 'zh-CN' } },
      map: { settings: { appDisplay: { language: 'zh' } } },
    };
  }

  function applyLocaleToSimulator(win, locale) {
    if (!win?.__OS__?.locale?.setLocale || !win?.__SIM__?.setState) return;
    win.__OS__.locale.setLocale(locale);
    win.__SIM__.setState({ apps: buildLocaleAppPatch(locale) }, { deep: true });
    // setState marks every patched app in `_benchmarkPatchedApps`, which RedBook
    // reads at mount to skip its async entity-data load (see RedBookApp.tsx).
    // The language patch is cosmetic — it shouldn't suppress data loading. Drop
    // the marker for the four apps we touch so RedBook still hydrates normally.
    const patched = win.__SIM__._benchmarkPatchedApps;
    if (patched?.delete) {
      ['redbook', 'alipay', 'bilibili', 'map'].forEach((id) => patched.delete(id));
    }
  }

  function getSelectedLanguageChoice() {
    const active = languageChoices.find((btn) => btn.getAttribute('aria-checked') === 'true');
    return active?.dataset?.languageChoice === 'en' ? 'en' : 'zh-Hans';
  }

  function applyLanguage(win) {
    const locale = getSelectedLanguageChoice();
    writeStoredLocale(locale);
    updateLanguageUI(locale);
    applyLocaleToSimulator(win, locale);
    setStudioStatus(`Phone language set to ${locale === 'en' ? 'English' : '中文'}.`, 'ok');
  }

  async function resetSession(win) {
    const snapshots = readSnapshots();
    setStudioStatus('Resetting simulator...', 'warn');
    await win.__SIM__.reset();
    writeSnapshots(snapshots);
    refreshSnapshotSelect();
    // __SIM__.reset() does localStorage.clear() inside the iframe (same-origin
    // with the parent), which intentionally also wipes our locale key — reset
    // means reset. The parent page does NOT reload, so the badge/radio still
    // show the pre-reset choice; resync them to the cleared state.
    updateLanguageUI(readStoredLocale());
  }

  async function saveSnapshot(win) {
    setStudioStatus('Saving snapshot...', 'warn');
    const state = compactSnapshotState(win.__SIM__.getState());
    const createdAt = Date.now();
    const fallbackName = `Snapshot ${toShortTime(createdAt)}`;
    const name = cleanText($('studio-snapshot-name').value, fallbackName, 48);
    const snapshot = {
      id: `snapshot-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt,
      state,
      timeConfig: win.__SIM_TIME__?.getConfig ? cloneJSON(win.__SIM_TIME__.getConfig()) : null,
      locationConfig: win.__SIM_LOCATION__?.getConfig ? cloneJSON(win.__SIM_LOCATION__.getConfig()) : null,
      locationCoords: win.__SIM_LOCATION__?.getCoords ? cloneJSON(win.__SIM_LOCATION__.getCoords()) : null,
    };
    try {
      const snapshots = [snapshot, ...readSnapshots().filter((item) => item.id !== snapshot.id)];
      writeSnapshots(snapshots);
      refreshSnapshotSelect(snapshot.id);
      $('studio-snapshot-name').value = `Snapshot ${toShortTime(Date.now())}`;
      setStudioStatus(`Snapshot saved: ${name}.`, 'ok');
    } catch (error) {
      setStudioStatus(error?.message || 'Could not save snapshot in this browser.', 'error');
    }
  }

  async function restoreSnapshot(win) {
    const id = $('studio-snapshot-select').value;
    const snapshot = readSnapshots().find((item) => item.id === id);
    if (!snapshot) {
      setStudioStatus('Choose a snapshot to restore.', 'error');
      return;
    }
    const snapshots = readSnapshots();
    const appsPatch = cloneJSON(snapshot.state?.apps || {});
    const shouldReloadRedBookData = appsPatch.redbook && !isHydratedRedBookSnapshot(appsPatch.redbook);
    if (win.__SIM__.resetState) {
      await win.__SIM__.resetState();
    }
    writeSnapshots(snapshots);
    refreshSnapshotSelect(id);
    win.__SIM__.setState({
      os: snapshot.state?.os || {},
      apps: appsPatch,
    }, { deep: false });
    if (shouldReloadRedBookData) {
      win.__SIM__._benchmarkPatchedApps?.delete?.('redbook');
      await waitForSnapshotData(win);
    }
    applySnapshotTime(win, snapshot);
    applySnapshotLocation(win, snapshot);
    syncStudioFromState();
    setStudioStatus(`Snapshot restored: ${snapshot.name || 'Snapshot'}.`, 'ok');
  }

  function deleteSnapshot() {
    const id = $('studio-snapshot-select').value;
    const snapshots = readSnapshots();
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) {
      setStudioStatus('Choose a snapshot to delete.', 'error');
      return;
    }
    writeSnapshots(snapshots.filter((item) => item.id !== id));
    refreshSnapshotSelect();
    setStudioStatus(`Snapshot deleted: ${snapshot.name || 'Snapshot'}.`, 'ok');
  }

  function applyDeviceTime(win, state) {
    const timeApi = win.__SIM_TIME__;
    if (!timeApi) {
      setStudioStatus('Time controls are not available yet.', 'error');
      return;
    }
    const mode = $('studio-device-time-mode').value;
    if (mode === 'real') {
      timeApi.setRealTime();
      timeApi.setSpeed(1);
      setStudioStatus('Device time follows real time.', 'ok');
      syncStudioFromState();
      return;
    }
    const timestamp = readLocalDatetimeInput('studio-device-time-value', getStateTime(state));
    const flow = $('studio-device-time-flow').value;
    const flowing = flow !== 'paused';
    const speed = flow === '100' ? 100 : flow === '10' ? 10 : 1;
    timeApi.setSimulatedTime(timestamp, flowing);
    timeApi.setSpeed(flowing ? speed : 1);
    setStudioStatus(`Device time set to simulated ${flowing ? `${speed}x` : 'paused'}.`, 'ok');
    syncStudioFromState();
  }

  function applyDeviceBattery(win) {
    const percent = Math.round(clampNumber($('studio-device-battery-level').value, 0, 100, 80));
    const status = $('studio-device-battery-status').value;
    const battery = {
      percent,
      charging: status === 'charging' || status === 'fast',
      fastCharging: status === 'fast',
    };
    win.__SIM__.setState({
      os: {
        hardware: { battery },
        settings: {
          global: {
            batterySaverEnabled: $('studio-device-battery-saver').value === 'on',
          },
        },
      },
    }, { deep: true });
    setStudioStatus(`Device battery set to ${percent}%.`, 'ok');
    syncStudioFromState();
  }

  function applyDeviceLocation(win) {
    const locationApi = win.__SIM_LOCATION__;
    if (!locationApi) {
      setStudioStatus('Location controls are not available yet.', 'error');
      return;
    }
    const preset = $('studio-device-location-preset').value;
    if (preset === 'custom') {
      const latitude = clampNumber($('studio-device-location-lat').value, -90, 90, 39.9042);
      const longitude = clampNumber($('studio-device-location-lon').value, -180, 180, 116.4074);
      locationApi.setSimulatedLocation({ latitude, longitude, accuracy: 100 });
      setStudioStatus(`Device location set to ${latitude.toFixed(4)}, ${longitude.toFixed(4)}.`, 'ok');
    } else {
      locationApi.setSimulatedLocation(preset);
      setStudioStatus(`Device location set to ${$('studio-device-location-preset').selectedOptions[0]?.text || preset}.`, 'ok');
    }
    syncStudioFromState();
  }

  function getWechatSelection(state) {
    const wechat = state.apps?.wechat || {};
    const contacts = Array.isArray(wechat.contacts) ? wechat.contacts : [];
    const chats = Array.isArray(wechat.chats) ? wechat.chats : [];
    const selectedWxid = $('studio-wechat-contact').value;
    let contact = contacts.find((item) => item.wxid === selectedWxid);
    if (!contact) {
      contact = contacts.find((item) => item.name === '陈静') || {
        wxid: 'demo_wechat_contact',
        name: '陈静',
        avatar: wechatAsset('avatars/avatar_88.jpg'),
        category: 'D',
        gender: '女',
        region: '中国 上海',
        permissionMode: 'all',
      };
    }
    return { contact, contacts, chats };
  }

  function insertWechatMessage(win, state) {
    const { contact, contacts, chats } = getWechatSelection(state);
    const nowTs = readLocalDatetimeInput('studio-wechat-time', getStateTime(state));
    const message = {
      id: `demo-wx-${nowTs}`,
      type: 'text',
      content: cleanText($('studio-wechat-message').value, '今晚 7 点开会，记得带材料。', 160),
      senderId: contact.wxid,
      timestamp: nowTs,
    };
    const existing = chats.find((item) => item.id === contact.wxid);
    const nextChat = existing
      ? {
          ...existing,
          user: existing.user || { wxid: contact.wxid, name: contact.name, avatar: contact.avatar },
          messages: [...(existing.messages || []), message],
        }
      : {
          id: contact.wxid,
          user: { wxid: contact.wxid, name: contact.name, avatar: contact.avatar },
          messages: [message],
          isMuted: false,
          isSticky: false,
          isAlert: false,
        };
    const nextContacts = contacts.some((item) => item.wxid === contact.wxid) ? contacts : [contact, ...contacts];
    const nextChats = [nextChat, ...chats.filter((item) => item.id !== contact.wxid)];
    win.__SIM__.setState({ apps: { wechat: { contacts: nextContacts, chats: nextChats } } }, { deep: true });
    setStudioStatus(`WeChat message inserted for ${contact.name}.`, 'ok');
  }

  function addWechatContact(win, state) {
    const wechat = state.apps?.wechat || {};
    const contacts = Array.isArray(wechat.contacts) ? wechat.contacts : [];
    const name = cleanText($('studio-wechat-new-name').value, '林小雨', 40);
    const wxid = cleanText($('studio-wechat-new-wxid').value, `demo_${Date.now()}`, 40);
    const signature = cleanText($('studio-wechat-new-signature').value, '明天会更好', 80);
    const avatar = wechatAsset(selectedWechatAvatar());
    const contact = {
      wxid,
      name,
      avatar,
      category: name.slice(0, 1).toUpperCase(),
      signature,
      region: '中国 上海',
      gender: '女',
      source: '通过 MobileGym Scenario Studio 添加',
      addedTime: '2026年5月',
      commonGroups: 0,
      memo: '',
      isBlacklisted: false,
      permissionMode: 'all',
      hideMyMoments: false,
      hideTheirMoments: false,
      aiConfig: { enabled: false },
    };
    const nextContacts = [contact, ...contacts.filter((item) => item.wxid !== wxid)];
    win.__SIM__.setState({ apps: { wechat: { contacts: nextContacts } } }, { deep: true });
    setStudioStatus(`WeChat contact added: ${name}.`, 'ok');
    syncStudioFromState();
  }

  function setAlipayBalance(win, state) {
    const alipay = state.apps?.alipay || {};
    const balance = {
      ...(alipay.balance || {}),
      total: money($('studio-alipay-balance').value, 520.13),
    };
    win.__SIM__.setState({ apps: { alipay: { balance } } }, { deep: true });
    setStudioStatus(`Alipay balance set to ${balance.total}.`, 'ok');
  }

  function addAlipayBill(win, state) {
    const alipay = state.apps?.alipay || {};
    const nowTs = getStateTime(state);
    const amount = Math.abs(money($('studio-alipay-amount').value, 32));
    const direction = $('studio-alipay-direction').value;
    const delta = direction === 'income' ? amount : -amount;
    const title = cleanText($('studio-alipay-title').value, '星巴克', 60);
    const note = cleanText($('studio-alipay-note').value, '拿铁', 80);
    const record = {
      id: `demo-alipay-${nowTs}`,
      counterpartyName: title,
      counterpartyAvatar: '',
      delta,
      timestamp: nowTs,
      displayTitle: title,
      detailTimeLabel: '支付时间',
      paymentMethod: '余额',
      transferNote: note,
      productDescription: note,
      category: direction === 'income' ? 'income' : 'dining',
      kind: direction === 'income' ? 'transfer' : 'payment',
      rewardPoints: Math.max(1, Math.round(amount)),
      orderId: `DEMO${nowTs}`,
      merchantOrderId: `MDEMO${nowTs}`,
    };
    const transferRecords = Array.isArray(alipay.transferRecords) ? alipay.transferRecords : [];
    win.__SIM__.setState({
      apps: {
        alipay: {
          transferRecords: [record, ...transferRecords],
        },
      },
    }, { deep: true });
    setStudioStatus(`Alipay bill added: ${title}, ${delta > 0 ? '+' : '-'}${amount}.`, 'ok');
  }

  function saveContactOnly(win) {
    const name = cleanText($('studio-contact-name').value, '张三', 40);
    const phone = cleanText($('studio-contact-phone').value, '13800138000', 24);
    const contactValues = {
      displayName: name,
      phone,
      phones: [{ label: '手机', number: phone, isPrimary: true }],
      starred: true,
    };
    try {
      const matched = win.__OS__.content.query(
        `content://contacts/contacts?phone=${encodeURIComponent(phone)}`,
      ).items?.[0];
      if (matched?.id) {
        win.__OS__.content.update(`content://contacts/contacts/${matched.id}`, contactValues);
        setStudioStatus(`Contact updated: ${name} (${phone}).`, 'ok');
      } else {
        win.__OS__.content.insert('content://contacts/contacts', contactValues);
        setStudioStatus(`Contact added: ${name} (${phone}).`, 'ok');
      }
    } catch (error) {
      setStudioStatus(error?.message || 'Could not save contact.', 'error');
    }
  }

  function sendSmsOnly(win) {
    const sender = cleanText($('studio-sms-sender').value, '12306', 32);
    const body = cleanText($('studio-sms-body').value, '您的验证码是 482913，用于 MobileGym 场景演示，请勿泄露。', 240);
    win.__OS__.broadcast.sendBroadcast({
      action: 'android.provider.Telephony.SMS_RECEIVED',
      extras: {
        from: sender,
        body,
      },
    });
    setStudioStatus(`Incoming SMS received from ${sender}.`, 'ok');
  }

  function addRailwayOrder(win, state) {
    const railway = state.apps?.railway12306 || {};
    const nowTs = getStateTime(state);
    const trainNo = cleanText($('studio-railway-train').value, 'G123', 20);
    const from = cleanText($('studio-railway-from').value, '北京南', 30);
    const to = cleanText($('studio-railway-to').value, '上海虹桥', 30);
    const date = cleanText($('studio-railway-date').value, '2026-05-03', 20);
    const departTime = cleanText($('studio-railway-depart').value, '09:30', 10);
    const arriveTime = cleanText($('studio-railway-arrive').value, '14:48', 10);
    const passengerName = cleanText($('studio-railway-passenger').value, '林小雨', 30);
    const seatType = cleanText($('studio-railway-seat-type').value, '二等座', 20);
    const seatNo = cleanText($('studio-railway-seat-no').value, '03车 08A号', 30);
    const price = money($('studio-railway-price').value, 553);
    const status = $('studio-railway-status').value;
    const orders = Array.isArray(railway.orders) ? railway.orders : [];
    const order = {
      id: `DEMO${nowTs}`,
      trainNo,
      fromStation: from,
      toStation: to,
      departTime,
      arriveTime,
      date,
      status,
      createTime: `${date}T09:00:00`,
      tickets: [{
        passengerName,
        ticketType: '成人',
        seatType,
        seatNo,
        price,
      }],
    };

    win.__SIM__.setState({
      apps: {
        railway12306: {
          orders: [order, ...orders],
        },
      },
    }, { deep: true });
    setStudioStatus(`12306 order added: ${trainNo} ${from} → ${to}.`, 'ok');
  }

  // 天况预设：text/icon 与 QWeather 编码对齐（icon 与 weatherBundles.json 一致）
  const WEATHER_CONDITION_PRESETS = {
    sunny:        { text: '晴',     icon: '100' },
    cloudy:       { text: '多云',   icon: '101' },
    overcast:     { text: '阴',     icon: '104' },
    'light-rain': { text: '小雨',   icon: '305' },
    'heavy-rain': { text: '大雨',   icon: '308' },
    thunderstorm: { text: '雷阵雨', icon: '302' },
    'light-snow': { text: '小雪',   icon: '400' },
    fog:          { text: '雾',     icon: '501' },
    haze:         { text: '霾',     icon: '502' },
  };

  // AQI → category/level 映射（与 normalizeAqiLevel 一致：6 级国标）
  function aqiClassify(aqi) {
    if (aqi <= 50)  return { category: '优',         level: '1' };
    if (aqi <= 100) return { category: '良',         level: '2' };
    if (aqi <= 150) return { category: '轻度污染',   level: '3' };
    if (aqi <= 200) return { category: '中度污染',   level: '4' };
    if (aqi <= 300) return { category: '重度污染',   level: '5' };
    return                  { category: '严重污染',   level: '6' };
  }

  function applyWeatherNow(win, state) {
    const located = state.apps?.weather?.bundlesByCityId?.located;
    if (!located?.bundle) {
      setStudioStatus('Located bundle not loaded yet — open Weather first to populate.', 'warn');
      return;
    }
    const conditionKey = $('studio-weather-condition').value;
    const condition = WEATHER_CONDITION_PRESETS[conditionKey] || WEATHER_CONDITION_PRESETS.sunny;
    const temp = String(Math.round(clampNumber($('studio-weather-temp').value, -50, 60, 20)));
    const high = String(Math.round(clampNumber($('studio-weather-high').value, -50, 60, 25)));
    const low  = String(Math.round(clampNumber($('studio-weather-low').value,  -50, 60, 15)));
    const aqiNum = Math.round(clampNumber($('studio-weather-aqi').value, 0, 500, 50));
    const aqi = String(aqiNum);
    const aqiMeta = aqiClassify(aqiNum);

    // daily 是数组，deepMerge 把数组当 atomic（整体替换）。要 patch daily[0] 的高低温，
    // 必须把当前 daily 整体读出 → 替换 daily[0] → 整体写回。
    const daily = (located.bundle.daily || []).map((day, idx) =>
      idx === 0 ? { ...day, tempMax: high, tempMin: low } : day,
    );

    win.__SIM__.setState({
      apps: {
        weather: {
          selectedCityId: 'located',
          bundlesByCityId: {
            located: {
              bundle: {
                now: {
                  temp,
                  feelsLike: temp,
                  text: condition.text,
                  icon: condition.icon,
                },
                daily,
                airQuality: {
                  aqi,
                  category: aqiMeta.category,
                  level: aqiMeta.level,
                },
              },
            },
          },
        },
      },
    }, { deep: true });

    setStudioStatus(`Weather patched: ${condition.text} ${temp}°C (H${high}/L${low}), AQI ${aqi}.`, 'ok');
    syncStudioFromState();
  }

  // iframe 内 scrollIntoView 会沿祖先 scroll container 链冒泡到父页面，浏览器 focus 时也会自动
  // scroll-into-view 跨 iframe 冒泡。同源前提下直接 patch iframe 内的两个 prototype：
  //   - scrollIntoView 改成只在 iframe 内最近的可滚祖先上滚动，到顶就停，不再外冒泡
  //   - focus 强制带 preventScroll，挡掉自动滚入视口
  // 部署约定：paper 与 simulator 必须同 origin（生产 mobilegym.dev/paper + mobilegym.dev/，
  // dev 用 vite 同时服务 http://localhost:3000/web/index.html + http://localhost:3000/）。
  // 不再保留跨域 fallback——非同源环境是配置错误，不是要支持的运行模式。
  function patchSimulatorScrollPropagation(iframe) {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) return;
    if (win.__demoScrollPatched) return;
    win.__demoScrollPatched = true;

    const ElementCtor = win.Element;
    const HTMLElementCtor = win.HTMLElement;
    if (!ElementCtor || !HTMLElementCtor) return;

    const origScrollIntoView = ElementCtor.prototype.scrollIntoView;
    ElementCtor.prototype.scrollIntoView = function patchedScrollIntoView(arg) {
      try {
        const ownerDoc = this.ownerDocument;
        const view = ownerDoc?.defaultView;
        if (!view) return origScrollIntoView.call(this, arg);

        let target = this.parentElement;
        while (target && target !== ownerDoc.documentElement) {
          const cs = view.getComputedStyle(target);
          const oy = cs.overflowY, ox = cs.overflowX;
          const scrollY = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && target.scrollHeight > target.clientHeight;
          const scrollX = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && target.scrollWidth > target.clientWidth;
          if (scrollY || scrollX) break;
          target = target.parentElement;
        }
        // 没有 iframe 内的可滚祖先就直接吞掉，不让浏览器走到 documentElement 再向父页冒泡。
        if (!target || target === ownerDoc.documentElement) return;

        const opts = arg === false
          ? { block: 'end', inline: 'nearest' }
          : arg === true
            ? { block: 'start', inline: 'nearest' }
            : (typeof arg === 'object' && arg) || {};
        const block = opts.block || 'start';
        const inline = opts.inline || 'nearest';
        const behavior = opts.behavior || 'auto';

        const elemRect = this.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        const offsetTop = elemRect.top - targetRect.top + target.scrollTop;
        let nextTop = target.scrollTop;
        if (block === 'start') nextTop = offsetTop;
        else if (block === 'end') nextTop = offsetTop - target.clientHeight + elemRect.height;
        else if (block === 'center') nextTop = offsetTop - target.clientHeight / 2 + elemRect.height / 2;
        else { // 'nearest'
          if (offsetTop < target.scrollTop) nextTop = offsetTop;
          else if (offsetTop + elemRect.height > target.scrollTop + target.clientHeight)
            nextTop = offsetTop - target.clientHeight + elemRect.height;
        }

        const offsetLeft = elemRect.left - targetRect.left + target.scrollLeft;
        let nextLeft = target.scrollLeft;
        if (inline === 'start') nextLeft = offsetLeft;
        else if (inline === 'end') nextLeft = offsetLeft - target.clientWidth + elemRect.width;
        else if (inline === 'center') nextLeft = offsetLeft - target.clientWidth / 2 + elemRect.width / 2;
        else { // 'nearest'
          if (offsetLeft < target.scrollLeft) nextLeft = offsetLeft;
          else if (offsetLeft + elemRect.width > target.scrollLeft + target.clientWidth)
            nextLeft = offsetLeft - target.clientWidth + elemRect.width;
        }

        target.scrollTo({
          top: Math.max(0, nextTop),
          left: Math.max(0, nextLeft),
          behavior,
        });
      } catch {
        return origScrollIntoView.call(this, arg);
      }
    };

    const origFocus = HTMLElementCtor.prototype.focus;
    HTMLElementCtor.prototype.focus = function patchedFocus(opts) {
      return origFocus.call(this, { ...(opts || {}), preventScroll: true });
    };
  }

  function powerOn() {
    // 本地预览支持：?sim=http://localhost:3000 指向独立 vite。注意 iframe 与父页必须同源，
    // 否则 patch 装不上、滚动会冒泡到父页面。推荐 dev 直接访问 vite 提供的 /web/index.html。
    const simSrc = new URLSearchParams(location.search).get('sim') || '/';
    frame.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = simSrc;
    iframe.title = 'MobileGym Live Simulator';
    iframe.allow = 'clipboard-write; gyroscope; accelerometer';
    iframe.className = 'block w-full h-full border-0';
    frame.appendChild(iframe);
    iframe.addEventListener('load', () => patchSimulatorScrollPropagation(iframe));
    iframe.addEventListener('load', () => {
      waitForSimulator()
        .then((win) => {
          // Only re-apply when the visitor has explicitly picked a language.
          // Without an explicit choice, leave each app on its natural default
          // (Map's null follows OS, Alipay's 'zh-CN', RedBook's 'zh-CN', etc.).
          const stored = readStoredLocale();
          if (stored) applyLocaleToSimulator(win, stored);
          syncStudioFromState();
          setStudioStatus('Simulator ready. Pick a scenario to apply.', 'ok');
        })
        .catch(() => setStudioStatus('Simulator is still loading. Try again in a moment.', 'warn'));
    });
    offBtn.classList.remove('hidden');
    offBtn.classList.add('inline-flex');
    setStudioStatus('Booting simulator — first load fetches app data, speed depends on your connection.', 'warn');
  }

  function powerOff() {
    frame.innerHTML = bootBtnHTML;
    // 恢复 boot 按钮的事件监听（innerHTML 重置后 listener 丢失）
    document.getElementById('demo-boot-btn').addEventListener('click', powerOn);
    offBtn.classList.add('hidden');
    offBtn.classList.remove('inline-flex');
    setStudioStatus('Power on the phone, then apply a scenario.', 'warn');
  }

  // ============================================================
  // State Popover + Dock plumbing
  // - Dock buttons share data-studio-tab with the popover's own
  //   tab strip, so switchStudioTab keeps both aria-selected in
  //   sync. Clicking a dock button OPENS the popover and switches
  //   to that tab.
  // - The popover is a card anchored to the right of the dock
  //   (no fullscreen drawer, no backdrop scrim). Closes via:
  //     · click anywhere outside the dock + popover
  //     · click on the close button
  //     · ESC
  // - First interaction marks body[data-state-dock-touched="true"]
  //   in sessionStorage so the pulse + "↑ Patch state" hint go
  //   away permanently for the rest of the browsing session.
  // ============================================================
  const STATE_DOCK_TOUCHED_KEY = 'mobilegym_state_dock_touched_v1';
  const stateDrawer = document.getElementById('state-drawer');
  const stateDrawerClose = document.getElementById('state-drawer-close');

  if (sessionStorage.getItem(STATE_DOCK_TOUCHED_KEY)) {
    document.body.dataset.stateDockTouched = 'true';
  }

  function markStateDockTouched() {
    if (document.body.dataset.stateDockTouched === 'true') return;
    document.body.dataset.stateDockTouched = 'true';
    try { sessionStorage.setItem(STATE_DOCK_TOUCHED_KEY, '1'); } catch { /* private mode */ }
  }

  function openStateDrawer() {
    const wasOpen = stateDrawer.dataset.open === 'true';
    stateDrawer.dataset.open = 'true';
    stateDrawer.setAttribute('aria-hidden', 'false');
    document.body.dataset.stateDrawerOpen = 'true';
    markStateDockTouched();
    // On narrow viewports the popover stacks below the phone in a
    // column flow — make sure it scrolls into view so the user
    // doesn't have to manually scroll. Skip when it was already open
    // (just switching tabs) to avoid yanking the page on every click.
    if (!wasOpen && window.innerWidth < 1280) {
      window.requestAnimationFrame(() => {
        stateDrawer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function closeStateDrawer() {
    stateDrawer.dataset.open = 'false';
    stateDrawer.setAttribute('aria-hidden', 'true');
    delete document.body.dataset.stateDrawerOpen;
  }

  studioTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      switchStudioTab(tab.dataset.studioTab);
      // Dock tabs additionally open the popover (drawer-internal tabs
      // already work without opening since the popover is visible).
      if (tab.dataset.stateDockTab) openStateDrawer();
    });
  });
  stateDrawerClose?.addEventListener('click', closeStateDrawer);
  // Outside-click dismiss. Skip if click landed on a dock tab (which
  // would re-open with a new tab) or inside the popover itself.
  document.addEventListener('click', (event) => {
    if (stateDrawer.dataset.open !== 'true') return;
    if (event.target.closest('.state-dock-tab')) return;
    if (event.target.closest('#state-drawer')) return;
    closeStateDrawer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && stateDrawer.dataset.open === 'true') {
      closeStateDrawer();
    }
  });
  studioActionTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchStudioAction(tab.dataset.studioAction));
  });
  $('studio-device-time-mode').addEventListener('change', () => {
    setDeviceTimeFlowOptions($('studio-device-time-mode').value, null);
  });
  $('studio-device-location-preset').addEventListener('change', syncLocationCustomVisibility);
  refreshSnapshotSelect();
  $('studio-snapshot-name').value = `Snapshot ${toShortTime(Date.now())}`;
  document.querySelectorAll('#studio-wechat-avatar-picker .avatar-choice').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#studio-wechat-avatar-picker .avatar-choice').forEach((item) => {
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
    });
  });
  $('studio-reset-session').addEventListener('click', () => withSimulator(resetSession));
  $('studio-save-snapshot').addEventListener('click', () => withSimulator(saveSnapshot));
  $('studio-restore-snapshot').addEventListener('click', () => withSimulator(restoreSnapshot));
  $('studio-delete-snapshot').addEventListener('click', deleteSnapshot);
  $('studio-insert-wechat-message').addEventListener('click', () => withSimulator(insertWechatMessage));
  $('studio-add-wechat-contact').addEventListener('click', () => withSimulator(addWechatContact));
  $('studio-apply-device-time').addEventListener('click', () => withSimulator(applyDeviceTime));
  $('studio-apply-device-battery').addEventListener('click', () => withSimulator(applyDeviceBattery));
  $('studio-apply-device-location').addEventListener('click', () => withSimulator(applyDeviceLocation));
  $('studio-set-alipay-balance').addEventListener('click', () => withSimulator(setAlipayBalance));
  $('studio-add-alipay-bill').addEventListener('click', () => withSimulator(addAlipayBill));
  $('studio-save-contact').addEventListener('click', () => withSimulator(saveContactOnly));
  $('studio-send-sms').addEventListener('click', () => withSimulator(sendSmsOnly));
  $('studio-add-railway-order').addEventListener('click', () => withSimulator(addRailwayOrder));
  $('studio-apply-weather-now').addEventListener('click', () => withSimulator(applyWeatherNow));

  languageChoices.forEach((btn) => {
    btn.addEventListener('click', () => {
      languageChoices.forEach((other) => {
        other.setAttribute('aria-checked', other === btn ? 'true' : 'false');
      });
    });
  });
  $('studio-apply-language').addEventListener('click', () => withSimulator(applyLanguage));
  updateLanguageUI(readStoredLocale());

  document.getElementById('demo-boot-btn').addEventListener('click', powerOn);
  offBtn.addEventListener('click', powerOff);
})();
