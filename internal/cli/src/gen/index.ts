#!/usr/bin/env node
import glob from 'fast-glob'
import fsp from 'fs/promises'
import _ from 'lodash'
import path from 'path'
import { replaceInFile } from 'replace-in-file'
import { pkgsDirJoin } from '../utils'
import * as admob from './admob'

const warnMessage =
  'THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.'

const indent4 = (n: number) => _.repeat(' ', 4 * n)

function buildJava(): string {
  const linesActions = _.map(
    admob.Actions,
    (v, k) =>
      `${indent4(2)}public static final String ${_.snakeCase(
        k,
      ).toUpperCase()} = "${v}";`,
  )
    .sort()
    .join('\n')

  const linesEvents = _.map(
    admob.Events,
    (v, k) =>
      `${indent4(2)}public static final String ${_.snakeCase(
        k,
      ).toUpperCase()} = "${v}";`,
  )
    .sort()
    .join('\n')

  const linesAdSizeType = [
    `${indent4(2)}${admob.AdSizeTypes.map((s) => `${s}`).join(', ')};`,
    '',
    `${indent4(2)}public static AdSize getAdSize(Object adSize) {`,
    ..._.flatMap(admob.AdSizeTypes, (s) => [
      `${indent4(3)}if (AdSizeType.${s}.equals(adSize)) {`,
      `${indent4(4)}return AdSize.${s};`,
      `${indent4(3)}}`,
    ]),
    `${indent4(3)}return null;`,
    `${indent4(2)}}`,
  ].join('\n')

  return `// ${warnMessage}
package admob.plugin;

import com.google.android.gms.ads.AdSize;

public final class Generated {
    public final class Actions {
${linesActions}
    }

    public final class Events {
${linesEvents}
    }

    public enum AdSizeType {
${linesAdSizeType}
    }
}
`
}

function buildGeneratedSwift(): string {
  const linesEvents = _.map(
    admob.Events,
    (v, k) => `${indent4(1)}static let ${_.camelCase(k)} = "${v}"`,
  )
    .sort()
    .join('\n')

  return `// ${warnMessage}
struct AMSBannerPosition {
    static let bottom = "bottom"
    static let top = "top"
}

struct AMSEvents {
${linesEvents}
}
`
}

const fireDocumentEventTs = `
export function fireDocumentEvent(eventName: string, data = null) {
  const event = new CustomEvent(eventName, { detail: data })
  document.dispatchEvent(event)
}`

function buildTypeScript(): string {
  const linesActions = _.map(admob.Actions, (v, k) => `  ${k} = '${v}',`)
    .sort()
    .join('\n')

  const linesEvents = _.map(admob.Events, (v, k) => `  ${k} = '${v}',`)
    .sort()
    .join('\n')

  const adSizeType = admob.AdSizeTypes.map((s) => `  ${s},`).join('\n')

  return `// ${warnMessage}
export enum NativeActions {
  Service = 'AdMob',
${linesActions}
}

export enum Events {
${linesEvents}
}

export enum AdSizeType {
${adSizeType}
}
${fireDocumentEventTs}
`
}

function buildConsentTypeScript(): string {
  return `// ${warnMessage}
${fireDocumentEventTs}
`
}

async function updateConfigXML() {
  const [androidFiles, iosFiles] = await Promise.all([
    glob(['**/*.java'], {
      cwd: pkgsDirJoin('cordova/src/android'),
    }),
    glob(['*.swift'], {
      cwd: pkgsDirJoin('cordova/src/ios'),
    }),
  ])
  const androidContent = androidFiles
    .map((s) => {
      let d = path.dirname(s.toString())
      d = d === '.' ? '' : `/${d}`
      return `        <source-file src="src/android/${s}" target-dir="src/admob/plugin${d}" />`
    })
    .sort()
    .join('\n')
  const iosContent = iosFiles
    .map((s) => `        <source-file src="src/ios/${s}" />`)
    .sort()
    .join('\n')
  await replaceInFile({
    files: [pkgsDirJoin('cordova/plugin.xml')],
    from: /([\S\s]*ANDROID_BEGIN -->\n)[\S\s]*(\n\s+<!-- AUTOGENERATED: ANDROID_END[\S\s]*IOS_BEGIN -->\n)[\S\s]*(\n\s+<!-- AUTOGENERATED: IOS_END[\S\s]*)/,
    to: `$1${androidContent}$2${iosContent}$3`,
  })
}

async function main() {
  const l = [
    {
      filepath: 'cordova/src/android/Generated.java',
      f: buildJava,
    },
    {
      filepath: 'cordova/src/ios/AMSGenerated.swift',
      f: buildGeneratedSwift,
    },
    { filepath: 'cordova/ts/generated.ts', f: buildTypeScript },
    { filepath: 'cordova-consent/ts/generated.ts', f: buildConsentTypeScript },
  ]
  await Promise.all(
    l.map(({ filepath, f }) =>
      fsp.writeFile(pkgsDirJoin(filepath), f(), 'utf8'),
    ),
  )

  await updateConfigXML()
}

main()
