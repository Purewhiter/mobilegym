/**
 * WMR XML parser.  Turns manifest.xml text into a typed WmrDocument.
 */
import type {
  WmrDocument, WmrRoot, WmrNode, WmrGroup, WmrImage, WmrText,
  WmrDateTime, WmrRectangle, WmrArc, WmrCircle, WmrButton, WmrVar, WmrVarArray,
  WmrContentProviderBinder, WmrProviderVariable, WmrProviderTrigger,
  WmrTrigger, WmrCommand, WmrBaseAttrs, WmrImageNumber, WmrMask,
  WmrArray, WmrTime, WmrMusicControl, WmrVariableAnimation,
  WmrBroadcastBinder, WmrFramerateController, WmrFunction, WmrLine,
  WmrVirtualElement, WmrFolmeState, WmrFolmeConfig, WmrPropertyAnimation,
} from './types';

function sanitizeWmrXml(xml: string): string {
  const normalized = xml.replace(/^\uFEFF/, '');

  return normalized.replace(
    /<([A-Za-z_][\w.-]*)(\s+[^<>]*?)?(\/?)>/g,
    (full, tagName: string, rawAttrs = '', selfClose = '') => {
      if (full.startsWith('</') || full.startsWith('<?') || full.startsWith('<!')) {
        return full;
      }

      const attrs: string[] = [];
      const seen = new Set<string>();
      const attrPattern = /([:@A-Za-z_][\w:./-]*)\s*=\s*(".*?"|'.*?')/g;
      const matches: Array<{ name: string; value: string }> = [];
      let match: RegExpExecArray | null;
      while ((match = attrPattern.exec(rawAttrs)) !== null) {
        matches.push({ name: match[1], value: match[2] });
      }

      for (let i = matches.length - 1; i >= 0; i--) {
        const { name, value } = matches[i];
        if (seen.has(name)) continue;
        seen.add(name);
        attrs.unshift(`${name}=${value}`);
      }

      const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
      return `<${tagName}${attrText}${selfClose}>`;
    },
  );
}

function parseXmlDocument(xml: string): XMLDocument {
  const parser = new DOMParser();
  const initialDoc = parser.parseFromString(xml, 'text/xml');

  const hasRoot = !!initialDoc.querySelector('Clock, Widget');
  const hasParseError = initialDoc.getElementsByTagName('parsererror').length > 0;
  if (hasRoot && !hasParseError) {
    return initialDoc;
  }

  const sanitized = sanitizeWmrXml(xml);
  if (sanitized !== xml || hasParseError) {
    const sanitizedDoc = parser.parseFromString(sanitized, 'text/xml');
    const sanitizedHasRoot = !!sanitizedDoc.querySelector('Clock, Widget');
    const sanitizedHasParseError = sanitizedDoc.getElementsByTagName('parsererror').length > 0;
    if (sanitizedHasRoot && !sanitizedHasParseError) {
      return sanitizedDoc;
    }
  }

  return initialDoc;
}

function attr(el: Element, name: string): string | undefined {
  return el.getAttribute(name) ?? undefined;
}

function directChildren(parent: Element, tagName?: string): Element[] {
  const children = Array.from(parent.children);
  if (!tagName) return children;
  return children.filter((child) => child.tagName === tagName);
}

function directChild(parent: Element, tagName: string): Element | null {
  return directChildren(parent, tagName)[0] ?? null;
}

function parseBaseAttrs(el: Element): WmrBaseAttrs {
  return {
    name: attr(el, 'name'),
    x: attr(el, 'x'),
    y: attr(el, 'y'),
    centerX: attr(el, 'centerX'),
    centerY: attr(el, 'centerY'),
    w: attr(el, 'w') ?? attr(el, 'width'),
    h: attr(el, 'h') ?? attr(el, 'height'),
    width: attr(el, 'width'),
    height: attr(el, 'height'),
    scale: attr(el, 'scale'),
    align: attr(el, 'align') as WmrBaseAttrs['align'],
    alignV: attr(el, 'alignV') as WmrBaseAttrs['alignV'],
    alpha: attr(el, 'alpha'),
    visibility: attr(el, 'visibility'),
    pivotX: attr(el, 'pivotX'),
    pivotY: attr(el, 'pivotY'),
    scaleX: attr(el, 'scaleX'),
    scaleY: attr(el, 'scaleY'),
    rotation: attr(el, 'rotation') ?? attr(el, 'angle'),
  };
}

function parseVariableAnimations(el: Element): WmrVariableAnimation[] {
  const animations: WmrVariableAnimation[] = [];
  for (const animEl of directChildren(el, 'VariableAnimation')) {
    const frames = parseAnimationFrames(animEl);
    if (frames.length === 0) continue;
    animations.push({
      name: attr(animEl, 'name'),
      tag: attr(animEl, 'tag'),
      frames,
      loop: attr(animEl, 'loop') === 'true',
      initPause: attr(animEl, 'initPause') === 'true',
      triggers: parseTriggers(animEl),
    });
  }
  return animations;
}

function parseAnimationFrames(animEl: Element) {
  return Array.from(animEl.children)
    .filter((frame) => frame.tagName === 'AniFrame' || frame.tagName === 'Item' || frame.tagName === 'Rotation')
    .map((frame) => ({
      value: attr(frame, 'value') ?? undefined,
      x: attr(frame, 'x') ?? undefined,
      y: attr(frame, 'y') ?? undefined,
      scaleX: attr(frame, 'scaleX') ?? attr(frame, 'value') ?? undefined,
      scaleY: attr(frame, 'scaleY') ?? attr(frame, 'value') ?? undefined,
      alpha: attr(frame, 'alpha') ?? attr(frame, 'value') ?? undefined,
      rotation: attr(frame, 'rotation') ?? attr(frame, 'angle') ?? attr(frame, 'value') ?? undefined,
      time: attr(frame, 'time') ?? attr(frame, 'dtime') ?? '0',
      relative: attr(frame, 'dtime') != null && attr(frame, 'time') == null,
      easeType: attr(frame, 'easeType') ?? attr(frame, 'easeExp') ?? undefined,
    }));
}

function parsePropertyAnimations(el: Element): WmrPropertyAnimation[] {
  const animations: WmrPropertyAnimation[] = [];
  const defs: Array<{ tag: string; kind: WmrPropertyAnimation['kind'] }> = [
    { tag: 'PositionAnimation', kind: 'position' },
    { tag: 'ScaleAnimation', kind: 'scale' },
    { tag: 'AlphaAnimation', kind: 'alpha' },
    { tag: 'RotationAnimation', kind: 'rotation' },
  ];
  for (const { tag, kind } of defs) {
    for (const animEl of directChildren(el, tag)) {
      const frames = parseAnimationFrames(animEl);
      if (frames.length === 0) continue;
      animations.push({
        kind,
        name: attr(animEl, 'name') ?? undefined,
        tag: attr(animEl, 'tag') ?? undefined,
        frames,
        loop: attr(animEl, 'loop') === 'true',
        initPause: attr(animEl, 'initPause') === 'true',
        triggers: parseTriggers(animEl),
      });
    }
  }
  return animations;
}

function parseRectangleFillShader(el: Element): WmrRectangle['fillShader'] {
  const shadersEl = directChild(el, 'FillShaders');
  const linearEl = shadersEl ? directChild(shadersEl, 'LinearGradient') : directChild(el, 'LinearGradient');
  if (!linearEl) return undefined;
  const stops = directChildren(linearEl, 'GradientStop').map((stopEl) => ({
    color: attr(stopEl, 'color') ?? '#ffffff',
    position: attr(stopEl, 'position') ?? '0',
  }));
  if (stops.length === 0) return undefined;
  return {
    type: 'linearGradient',
    x: attr(linearEl, 'x'),
    y: attr(linearEl, 'y'),
    x1: attr(linearEl, 'x1'),
    y1: attr(linearEl, 'y1'),
    stops,
  };
}

function parseCommands(triggerEl: Element): WmrCommand[] {
  const cmds: WmrCommand[] = [];
  for (const ch of Array.from(triggerEl.children)) {
    switch (ch.tagName) {
      case 'IntentCommand':
        cmds.push({
          type: 'intent',
          action: attr(ch, 'action'),
          actionExp: attr(ch, 'actionExp'),
          package: attr(ch, 'package'),
          packageExp: attr(ch, 'packageExp'),
          class: attr(ch, 'class'),
          classExp: attr(ch, 'classExp'),
          broadcast: attr(ch, 'broadcast') === 'true',
          condition: attr(ch, 'condition'),
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          extras: directChildren(ch, 'Extra').map((extraEl) => ({
            name: attr(extraEl, 'name') ?? '',
            type: attr(extraEl, 'type') ?? undefined,
            expression: attr(extraEl, 'expression') ?? undefined,
          })).filter((extra) => extra.name),
          fallback: directChild(ch, 'Fallback') ? parseCommands(directChild(ch, 'Fallback')!) : undefined,
        });
        break;
      case 'VariableCommand':
        cmds.push({
          type: 'variable',
          name: attr(ch, 'name') ?? '',
          expression: attr(ch, 'expression') ?? '0',
          persist: attr(ch, 'persist') === 'true',
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          condition: attr(ch, 'condition'),
          index: attr(ch, 'index'),
          valueType: attr(ch, 'type'),
        });
        break;
      case 'AnimationCommand':
        cmds.push({
          type: 'animation',
          target: attr(ch, 'target') ?? '',
          command: attr(ch, 'command') ?? '',
          tags: attr(ch, 'tags') ?? undefined,
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          condition: attr(ch, 'condition'),
        });
        break;
      case 'FrameRateCommand':
        cmds.push({
          type: 'frameRate',
          rate: attr(ch, 'rate') ?? '0',
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          condition: attr(ch, 'condition'),
        });
        break;
      case 'BinderCommand':
        cmds.push({
          type: 'binder',
          name: attr(ch, 'name') ?? '',
          command: attr(ch, 'command') ?? '',
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          condition: attr(ch, 'condition'),
        });
        break;
      case 'FolmeCommand':
        cmds.push({
          type: 'folme',
          target: attr(ch, 'target') ?? '',
          states: attr(ch, 'states'),
          config: attr(ch, 'config'),
          command: attr(ch, 'command') ?? 'to',
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          condition: attr(ch, 'condition'),
        });
        break;
      case 'LoopCommand':
        cmds.push({
          type: 'loop',
          count: attr(ch, 'count') ?? '0',
          indexName: attr(ch, 'indexName'),
          condition: attr(ch, 'condition'),
          commands: parseCommands(ch),
        });
        break;
      case 'MultiCommand':
        cmds.push({
          type: 'multi',
          condition: attr(ch, 'condition'),
          commands: parseCommands(ch),
        });
        break;
      case 'Command': {
        const target = attr(ch, 'target') ?? '';
        const value = attr(ch, 'value') ?? attr(ch, 'command') ?? '';
        if (target.endsWith('.animation')) {
          cmds.push({
            type: 'animation',
            target: target.replace(/\.animation$/, ''),
            command: value || 'play',
            delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
            condition: attr(ch, 'condition'),
          });
        } else if (target && value) {
          cmds.push({
            type: 'method',
            target,
            method: value,
            delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
            condition: attr(ch, 'condition'),
          });
        } else {
          cmds.push({
            type: 'multi',
            condition: attr(ch, 'condition'),
            commands: parseCommands(ch),
          });
        }
        break;
      }
      case 'FunctionCommand':
        cmds.push({
          type: 'function',
          target: attr(ch, 'target') ?? '',
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          condition: attr(ch, 'condition') ?? attr(ch, 'delayCondition'),
        });
        break;
      case 'MethodCommand':
        cmds.push({
          type: 'method',
          target: attr(ch, 'target') ?? '',
          targetType: attr(ch, 'targetType') ?? undefined,
          method: attr(ch, 'method') ?? '',
          params: attr(ch, 'params') ?? undefined,
          paramTypes: attr(ch, 'paramTypes') ?? undefined,
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
          condition: attr(ch, 'condition'),
        });
        break;
      case 'IfCommand':
        cmds.push({
          type: 'if',
          condition: attr(ch, 'ifCondition') ?? attr(ch, 'condition'),
          consequent: directChild(ch, 'Consequent') ? parseCommands(directChild(ch, 'Consequent')!) : parseCommands(ch),
          alternate: directChild(ch, 'Alternate') ? parseCommands(directChild(ch, 'Alternate')!) : undefined,
        });
        break;
      case 'ExternCommand':
        cmds.push({
          type: 'extern',
          command: attr(ch, 'command') ?? '',
          condition: attr(ch, 'condition'),
          delay: attr(ch, 'delay') ? parseInt(attr(ch, 'delay')!, 10) : undefined,
        });
        break;
    }
  }
  return cmds;
}

function parseTriggers(parentEl: Element): WmrTrigger[] {
  const triggers: WmrTrigger[] = [];
  const triggerParents = directChild(parentEl, 'Triggers')
    ? directChildren(directChild(parentEl, 'Triggers')!, 'Trigger')
    : directChildren(parentEl, 'Trigger');
  for (const t of triggerParents) {
    triggers.push({
      action: attr(t, 'action') ?? 'up',
      condition: attr(t, 'condition'),
      commands: parseCommands(t),
    });
  }
  return triggers;
}

function parseNode(el: Element): WmrNode | null {
  const tag = el.tagName;
  switch (tag) {
    case 'Group':
      return {
        ...parseBaseAttrs(el),
        tag: 'Group',
        layered: attr(el, 'layered') === 'true',
        clip: attr(el, 'clip') === 'true',
        triggers: parseTriggers(el),
        animations: parsePropertyAnimations(el),
        children: parseChildren(el),
      } as WmrGroup;

    case 'Image':
      return {
        ...parseBaseAttrs(el),
        tag: 'Image',
        src: attr(el, 'src'),
        srcExp: attr(el, 'srcExp'),
        srcid: attr(el, 'srcid'),
        tint: attr(el, 'tint'),
        xfermode: attr(el, 'xfermode'),
        xfermodeNum: attr(el, 'xfermodeNum'),
        animations: parsePropertyAnimations(el),
      } as WmrImage;

    case 'Text':
      return {
        ...parseBaseAttrs(el),
        tag: 'Text',
        text: attr(el, 'text'),
        textExp: attr(el, 'textExp'),
        color: attr(el, 'color'),
        size: attr(el, 'size'),
        format: attr(el, 'format'),
        paras: attr(el, 'paras'),
        bold: attr(el, 'bold') === 'true',
        fontFamily: attr(el, 'fontFamily'),
        marqueeSpeed: attr(el, 'marqueeSpeed'),
        multiLine: attr(el, 'multiLine') === 'true',
        animations: parsePropertyAnimations(el),
      } as WmrText;

    case 'DateTime':
      return {
        ...parseBaseAttrs(el),
        tag: 'DateTime',
        format: attr(el, 'format'),
        formatExp: attr(el, 'formatExp'),
        value: attr(el, 'value'),
        color: attr(el, 'color'),
        size: attr(el, 'size'),
        bold: attr(el, 'bold') === 'true',
        fontFamily: attr(el, 'fontFamily'),
        marqueeSpeed: attr(el, 'marqueeSpeed'),
        animations: parsePropertyAnimations(el),
      } as WmrDateTime;

    case 'Rectangle':
      return {
        ...parseBaseAttrs(el),
        tag: 'Rectangle',
        fillColor: attr(el, 'fillColor'),
        fillShader: parseRectangleFillShader(el),
        cornerRadius: attr(el, 'cornerRadius') ?? attr(el, 'cornerRadiusExp'),
        strokeColor: attr(el, 'strokeColor'),
        strokeWidth: attr(el, 'strokeWidth'),
        weight: attr(el, 'weight'),
        strokeAlign: attr(el, 'strokeAlign'),
        xfermodeNum: attr(el, 'xfermodeNum'),
        triggers: parseTriggers(el),
        animations: parsePropertyAnimations(el),
      } as WmrRectangle;

    case 'Arc':
      return {
        ...parseBaseAttrs(el),
        tag: 'Arc',
        startAngle: attr(el, 'startAngle'),
        sweep: attr(el, 'sweep'),
        strokeColor: attr(el, 'strokeColor'),
        weight: attr(el, 'weight'),
        cap: attr(el, 'cap'),
        close: attr(el, 'close'),
        strokeAlign: attr(el, 'strokeAlign'),
        fillColor: attr(el, 'fillColor'),
        xfermode: attr(el, 'xfermode'),
        xfermodeNum: attr(el, 'xfermodeNum'),
        animations: parsePropertyAnimations(el),
      } as WmrArc;

    case 'Circle':
      return {
        ...parseBaseAttrs(el),
        tag: 'Circle',
        r: attr(el, 'r'),
        fillColor: attr(el, 'fillColor'),
        strokeColor: attr(el, 'strokeColor'),
        weight: attr(el, 'weight'),
        xfermode: attr(el, 'xfermode'),
        xfermodeNum: attr(el, 'xfermodeNum'),
        animations: parsePropertyAnimations(el),
      } as WmrCircle;

    case 'Button':
      const normalEl = directChild(el, 'Normal');
      const pressedEl = directChild(el, 'Pressed');
      return {
        ...parseBaseAttrs(el),
        tag: 'Button',
        triggers: parseTriggers(el),
        animations: parsePropertyAnimations(el),
        children: parseChildren(el),
        normalChildren: normalEl ? parseChildren(normalEl) : undefined,
        pressedChildren: pressedEl ? parseChildren(pressedEl) : undefined,
      } as WmrButton;

    case 'Var':
      const animations = parseVariableAnimations(el);
      return {
        tag: 'Var',
        name: attr(el, 'name') ?? '',
        expression: attr(el, 'expression') ?? '0',
        type: attr(el, 'type'),
        const: attr(el, 'const') === 'true',
        index: attr(el, 'index'),
        values: attr(el, 'values')?.split(',').map((part) => part.trim()).filter(Boolean),
        persist: attr(el, 'persist') === 'true',
        threshold: attr(el, 'threshold'),
        triggers: parseTriggers(el),
        animation: animations[0],
        animations,
      } as WmrVar;

    case 'VarArray': {
      const vars: WmrVar[] = [];
      const items: string[] = [];
      const varsParent = directChild(el, 'Vars');
      for (const varsEl of varsParent ? directChildren(varsParent, 'Var') : []) {
        vars.push({
          tag: 'Var',
          name: attr(varsEl, 'name') ?? '',
          expression: attr(varsEl, 'expression') ?? '0',
          type: attr(varsEl, 'type'),
          index: attr(varsEl, 'index'),
        });
      }
      const itemsParent = directChild(el, 'Items');
      for (const itemEl of itemsParent ? directChildren(itemsParent, 'Item') : []) {
        items.push(attr(itemEl, 'value') ?? '');
      }
      return {
        tag: 'VarArray',
        name: attr(el, 'name'),
        type: attr(el, 'type'),
        vars,
        items,
      } as WmrVarArray;
    }

    case 'ContentProviderBinder': {
      const variables: WmrProviderVariable[] = [];
      const triggers: WmrProviderTrigger[] = [];
      for (const ch of Array.from(el.children)) {
        if (ch.tagName === 'Variable') {
          variables.push({
            column: attr(ch, 'column') ?? '',
            name: attr(ch, 'name') ?? '',
            type: attr(ch, 'type') ?? 'string',
            extra: attr(ch, 'extra'),
            row: attr(ch, 'row') ?? attr(ch, 'rows'),
          });
        }
        if (ch.tagName === 'Trigger') {
          triggers.push({ commands: parseCommands(ch) });
        }
      }
      return {
        tag: 'ContentProviderBinder',
        name: attr(el, 'name'),
        uri: attr(el, 'uri'),
        uriFormat: attr(el, 'uriFormat'),
        uriParas: attr(el, 'uriParas'),
        columns: attr(el, 'columns'),
        countName: attr(el, 'countName'),
        dependency: attr(el, 'dependency'),
        variables,
        triggers,
      } as WmrContentProviderBinder;
    }

    case 'BroadcastBinder': {
      const variables: WmrProviderVariable[] = [];
      for (const ch of Array.from(el.children)) {
        if (ch.tagName !== 'Variable') continue;
        variables.push({
          column: attr(ch, 'column') ?? '',
          name: attr(ch, 'name') ?? '',
          type: attr(ch, 'type') ?? 'string',
          extra: attr(ch, 'extra'),
          row: attr(ch, 'row') ?? attr(ch, 'rows'),
        });
      }
      return {
        tag: 'BroadcastBinder',
        action: attr(el, 'action'),
        variables,
        triggers: parseTriggers(el),
      } as WmrBroadcastBinder;
    }

    case 'ImageNumber':
      return {
        ...parseBaseAttrs(el),
        tag: 'ImageNumber',
        src: attr(el, 'src'),
        textExp: attr(el, 'textExp'),
        animations: parsePropertyAnimations(el),
      } as WmrImageNumber;

    case 'Mask':
      return {
        ...parseBaseAttrs(el),
        tag: 'Mask',
        animations: parsePropertyAnimations(el),
        children: parseChildren(el),
      } as WmrMask;

    case 'Array':
      return {
        ...parseBaseAttrs(el),
        tag: 'Array',
        count: attr(el, 'count'),
        indexName: attr(el, 'indexName'),
        animations: parsePropertyAnimations(el),
        children: parseChildren(el),
      } as WmrArray;

    case 'Time':
      return {
        ...parseBaseAttrs(el),
        tag: 'Time',
        src: attr(el, 'src'),
        srcExp: attr(el, 'srcExp'),
        format: attr(el, 'format'),
        formatExp: attr(el, 'formatExp'),
        space: attr(el, 'space'),
        animations: parsePropertyAnimations(el),
      } as WmrTime;

    case 'MusicControl':
      return { ...parseBaseAttrs(el), tag: 'MusicControl', children: parseChildren(el) } as WmrMusicControl;

    case 'Function':
      return {
        tag: 'Function',
        name: attr(el, 'name') ?? '',
        commands: parseCommands(el),
      } as WmrFunction;

    case 'Line':
      return {
        ...parseBaseAttrs(el),
        tag: 'Line',
        x1: attr(el, 'x1'),
        y1: attr(el, 'y1'),
        strokeColor: attr(el, 'strokeColor'),
        weight: attr(el, 'weight'),
        cap: attr(el, 'cap'),
      } as WmrLine;

    case 'VirtualElement':
      return {
        ...parseBaseAttrs(el),
        tag: 'VirtualElement',
        folmeMode: attr(el, 'folmeMode') === 'true',
      } as WmrVirtualElement;

    case 'FolmeState':
      return {
        tag: 'FolmeState',
        name: attr(el, 'name') ?? '',
        x: attr(el, 'x'),
        y: attr(el, 'y'),
        alpha: attr(el, 'alpha'),
        scaleX: attr(el, 'scaleX'),
        scaleY: attr(el, 'scaleY'),
        rotation: attr(el, 'rotation'),
      } as WmrFolmeState;

    case 'FolmeConfig':
      return {
        tag: 'FolmeConfig',
        name: attr(el, 'name') ?? '',
        ease: attr(el, 'ease'),
        delay: attr(el, 'delay'),
        onComplete: attr(el, 'onComplete'),
        specials: directChildren(el, 'Special').map((specialEl) => ({
          property: attr(specialEl, 'property') ?? '',
          ease: attr(specialEl, 'ease'),
        })),
      } as WmrFolmeConfig;

    default:
      return null;
  }
}

const SKIP_TAGS = new Set([
  'VariableBinders', 'Triggers', 'Trigger', 'Vars', 'Items', 'Item',
  'IntentCommand', 'VariableCommand', 'ExternCommand', 'Variable',
  'AniFrame', 'AnimationCommand', 'VariableAnimation', 'FramerateController',
  'ControlPoint', 'MultiCommand', 'LoopCommand', 'Command',
  'BinderCommand', 'FrameRateCommand', 'MethodCommand', 'Extra', 'Special',
  'Rotation',
  'Normal', 'Pressed',
  'PositionAnimation', 'ScaleAnimation', 'AlphaAnimation', 'RotationAnimation',
  'Consequent', 'Alternate', 'Fallback',
]);

function parseFramerateControllers(rootEl: Element): WmrFramerateController[] {
  return directChildren(rootEl, 'FramerateController').map((controllerEl) => ({
    name: attr(controllerEl, 'name') ?? '',
    loop: attr(controllerEl, 'loop') === 'true',
    initPause: attr(controllerEl, 'initPause') === 'true',
    controlPoints: directChildren(controllerEl, 'ControlPoint').map((pointEl) => ({
      time: parseInt(attr(pointEl, 'time') ?? '0', 10) || 0,
      frameRate: parseInt(attr(pointEl, 'frameRate') ?? '0', 10) || 0,
    })),
  })).filter((controller) => controller.name && controller.controlPoints.length > 0);
}

function parseChildren(parent: Element): WmrNode[] {
  const nodes: WmrNode[] = [];
  for (const ch of directChildren(parent)) {
    if (SKIP_TAGS.has(ch.tagName)) continue;
    const node = parseNode(ch);
    if (node) nodes.push(node);
  }
  // Also parse VariableBinders at this level
  const vb = directChild(parent, 'VariableBinders');
  if (vb) {
    for (const ch of directChildren(vb)) {
      const node = parseNode(ch);
      if (node) nodes.push(node);
    }
  }
  return nodes;
}

export function parseWmr(xml: string): WmrDocument {
  const doc = parseXmlDocument(xml);
  const rootEl = doc.querySelector('Clock, Widget');
  if (!rootEl) throw new Error('WMR: no <Clock>/<Widget> root element');

  const root: WmrRoot = {
    tag: rootEl.tagName === 'Widget' ? 'Widget' : 'Clock',
    attrs: {
      frameRate: attr(rootEl, 'frameRate'),
      screenWidth: attr(rootEl, 'screenWidth'),
      width: attr(rootEl, 'width'),
      height: attr(rootEl, 'height'),
      resDensity: attr(rootEl, 'resDensity'),
      scaleByDensity: attr(rootEl, 'scaleByDensity'),
      useVariableUpdater: attr(rootEl, 'useVariableUpdater'),
      version: attr(rootEl, 'version'),
    },
    children: parseChildren(rootEl),
    externalTriggers: parseTriggers(directChild(rootEl, 'ExternalCommands') ?? rootEl),
  };

  const designWidth = parseInt(root.attrs.width ?? root.attrs.screenWidth ?? '1080', 10) || 1080;
  const designHeightRaw = parseInt(root.attrs.height ?? '', 10);
  const frameRateRaw = root.attrs.frameRate;
  const parsedFrameRate = frameRateRaw == null ? 0 : parseInt(frameRateRaw, 10);
  const frameRate = Number.isFinite(parsedFrameRate) ? Math.max(0, parsedFrameRate) : 0;
  const updaters = (root.attrs.useVariableUpdater ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return {
    root,
    designWidth,
    designHeight: Number.isFinite(designHeightRaw) && designHeightRaw > 0 ? designHeightRaw : undefined,
    frameRate,
    useVariableUpdater: updaters,
    framerateControllers: parseFramerateControllers(rootEl),
  };
}
