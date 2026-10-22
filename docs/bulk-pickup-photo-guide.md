# Pickup bulk-photo instructions — Rider Build 127

For riders, drivers and helpers using Pickup Verification.

## Example: 99 parcels, 97 at 2 kg and two at 4 kg

1. Install [Rider Build 127](https://www.britiumexpress.app/downloads/Britium-Express-Rider-Build127.apk) over the existing app. Check the build number after opening it. Keep the original photos on the phone until every parcel is saved and visible to Enterprise staff.
2. Sign in with your own field-worker account. Open the assigned pickup and check its pickup number and expected parcel count.
3. Enter **2 kg** in the batch-weight field and select **Apply Weight to All Unsaved Parcels**. Review existing weights; the normal action fills blank weights. Use the replace option only when you intend to change existing unsaved weights.
4. Select photos in batches of **up to 10**. The app assigns each selected batch to the next empty parcel slots. Check the actual parcel number and preview on every card; gallery selection order must match the parcels. Wait for the batch to finish preparing before adding the next batch.
5. Continue until the 97 ordinary parcels have the correct photos. Select the two remaining photos against their intended parcel cards, and change those cards to **4 kg**. Check all 99 parcel/photo matches and weights before proceeding.
6. Select **Approve & Upload All Photos**. Wait for the result. Uploading stores the photos; it does not by itself save the parcel records for Enterprise review.
7. Select **Save All Ready Parcels**. Wait for the save result and check the saved count against the expected 99. A partial result is not completion.
8. Enterprise staff open the same pickup, refresh its workspace, and check the parcel photos and weights before review and subsequent processing. Follow the pickup's displayed next action only after the required verification is complete.

After an Enterprise review, use **Refresh** in the Rider pickup workspace to load the latest decision and rejection note. If replacement is required, replace the photo on that parcel, upload and save it again, then let Enterprise review the new evidence. When a photo is unavailable, the existing audited reason-only exception is recorded in Data Entry; an empty photo is not approved as if evidence existed.

## Failed uploads, interrupted saves or a stuck screen

- Read the failed parcel numbers in the result, for example **9, 10, 11**. Check those cards and retry upload/save. Bulk saving skips parcels already confirmed saved.
- Build 126 stores prepared photos and weights locally for the signed-in account and pickup. After a refresh, reopen that same assigned pickup to recover the draft. A recovered draft still needs upload/save confirmation.
- If a red local-storage warning appears, keep the screen open and choose **Retry draft backup**. Wait until the warning clears before refreshing. Local recovery requires available device/browser storage; uninstalling the app, clearing its data or clearing site storage can remove local drafts.
- Keep the original phone photos until server saves and Enterprise visibility are confirmed. Do not repeatedly select the whole batch when only a few parcel numbers failed.

## Replacing the wrong photo

Open the correct parcel card, use its camera or gallery control, review the new preview, approve/upload it, then save that parcel again. When an uploaded photo already exists, confirm the replacement only after checking the parcel number. A failed replacement keeps the previous photo available. Enterprise review may be required again for the replacement.

## Repeated photo selections

The duplicate-photo update compares image content, including previously saved pickup photos. Re-selecting an image under another filename does not add another parcel. A batch containing 10 selections with two already present adds only eight new photos, without leaving gaps. The result names the existing parcel for each skipped photo. Different images sharing a filename remain allowed.

Before pickup verification, the app also checks older saved photos for duplicates and identifies matching parcel lines. Open those cards, compare them with the actual parcels, and replace the incorrect photo with its missing original. A saved count such as 88/88 does not prove that 88 different parcel photos exist. Existing records and images are preserved; the app does not choose which duplicate line is correct or delete it automatically.

## Recovering work from an older build

The update cannot reconstruct a photo that the older app never uploaded and lost from memory. Existing server photos remain available. Reselect only the missing originals against their correct parcel numbers, restore their actual weights, upload and save them. Do not change the already saved parcel/photo matches merely to fill a count.
