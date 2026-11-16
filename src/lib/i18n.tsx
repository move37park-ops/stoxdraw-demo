import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  I18nContext,
  LANG_STORAGE_KEY,
  HAS_KOREAN_REGEX,
  TRANSLATABLE_ATTRS,
  readStoredLocale,
  translateKoToEn,
  shouldSkipTextNode,
  type Locale,
  type TranslatableAttr,
  type I18nContextValue,
} from './i18nCore';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState(prev => {
      const next: Locale = prev === 'ko' ? 'en' : 'ko';
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANG_STORAGE_KEY || event.key === null) {
        setLocaleState(readStoredLocale());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Reversible DOM translation observer for chart/report copy and third-level components
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;

    const originalTextMap = new WeakMap<Text, string>();
    const originalAttrMap = new WeakMap<Element, Partial<Record<TranslatableAttr, string>>>();

    const processTextNode = (node: Text, targetLocale: Locale) => {
      if (shouldSkipTextNode(node)) return;
      const current = node.nodeValue ?? '';
      if (targetLocale === 'en') {
        if (!HAS_KOREAN_REGEX.test(current)) return;
        originalTextMap.set(node, current);
        const translated = translateKoToEn(current);
        if (translated !== current) {
          node.nodeValue = translated;
        }
      } else {
        if (HAS_KOREAN_REGEX.test(current)) {
          originalTextMap.delete(node);
          return;
        }
        const orig = originalTextMap.get(node);
        if (orig !== undefined && node.nodeValue !== orig) {
          node.nodeValue = orig;
        }
      }
    };

    const processElementAttrs = (el: Element, targetLocale: Locale) => {
      for (const attr of TRANSLATABLE_ATTRS) {
        const current = el.getAttribute(attr);
        if (current === null) continue;
        if (targetLocale === 'en') {
          if (!HAS_KOREAN_REGEX.test(current)) continue;
          const record = originalAttrMap.get(el) ?? {};
          record[attr] = current;
          originalAttrMap.set(el, record);
          const translated = translateKoToEn(current);
          if (translated !== current) {
            el.setAttribute(attr, translated);
          }
        } else {
          const record = originalAttrMap.get(el);
          if (HAS_KOREAN_REGEX.test(current)) {
            if (record) delete record[attr];
            continue;
          }
          const orig = record?.[attr];
          if (orig !== undefined && current !== orig) {
            el.setAttribute(attr, orig);
          }
        }
      }
    };

    const walkSubtree = (root: Node, targetLocale: Locale) => {
      if (root.nodeType === Node.TEXT_NODE) {
        processTextNode(root as Text, targetLocale);
        return;
      }
      if (root.nodeType === Node.ELEMENT_NODE) {
        processElementAttrs(root as Element, targetLocale);
      }
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
      );
      let cur: Node | null = walker.nextNode();
      while (cur) {
        if (cur.nodeType === Node.TEXT_NODE) {
          processTextNode(cur as Text, targetLocale);
        } else if (cur.nodeType === Node.ELEMENT_NODE) {
          processElementAttrs(cur as Element, targetLocale);
        }
        cur = walker.nextNode();
      }
    };

    walkSubtree(document.body, locale);

    if (locale === 'ko') {
      return;
    }

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          processTextNode(m.target as Text, 'en');
        } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
          processElementAttrs(m.target as Element, 'en');
        } else if (m.type === 'childList') {
          m.addedNodes.forEach(added => walkSubtree(added, 'en'));
        }
      }
      observer.takeRecords();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRS],
    });
    observer.takeRecords();

    return () => {
      observer.disconnect();
      walkSubtree(document.body, 'ko');
    };
  }, [locale]);

  const t = useCallback(
    (ko: string, en: string) => (locale === 'en' ? en : ko),
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
