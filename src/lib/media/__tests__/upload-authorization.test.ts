import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentItems, contentVariants } from "@/db/schema";
const mocks=vi.hoisted(()=>({db:vi.fn(),sign:vi.fn()}));
vi.mock("@/db",()=>({getDb:mocks.db}));
vi.mock("@/lib/workspace",()=>({getActiveContext:async()=>({workspaceId:"11111111-1111-4111-a111-111111111111",userId:"22222222-2222-4222-a222-222222222222"})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({storage:{from:()=>({createSignedUploadUrl:mocks.sign})}})}));
vi.mock("@/lib/crypto/tokens",()=>({encryptToken:(value:string)=>value,decryptToken:(value:string)=>value}));
vi.mock("@/lib/security/rate-limit",()=>({rateLimit:()=>({allowed:true})}));
vi.mock("@/lib/media/lifecycle",()=>({checkUploadQuota:async()=>null}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { beginMediaUploadAction } from "@/server/actions/media-upload";
const itemId="33333333-3333-4333-a333-333333333333";
const variantId="44444444-4444-4444-a444-444444444444";
function fixture(variantFormat: "reel" | "carousel", variantStatus="ready_for_review") {
  mocks.db.mockReturnValue({select:()=>({from:(table:unknown)=>({where:async()=>table===contentItems?[{id:itemId,format:"carousel",status:"ready_for_review"}]:table===contentVariants?[{id:variantId,format:variantFormat,status:variantStatus}]:[]})})});
}
beforeEach(()=>{vi.clearAllMocks();mocks.sign.mockResolvedValue({data:{token:"signed"},error:null});});
describe("media upload authorization follows the selected platform variant",()=>{
  it("accepts a MOV for a Reel variant under a Carousel parent and binds that variant into the ticket",async()=>{
    fixture("reel");const result=await beginMediaUploadAction({itemId,variantId,name:"reel.mov",mime:"video/quicktime",size:1024});
    expect(result.ok).toBe(true);if(result.ok)expect(JSON.parse(result.ticket)).toMatchObject({itemId,variantId,mime:"video/quicktime"});
  });
  it("continues to accept Carousel images",async()=>{
    fixture("carousel");expect((await beginMediaUploadAction({itemId,variantId,name:"slide.png",mime:"image/png",size:1024})).ok).toBe(true);
  });
  it("rejects images for a Reel variant and videos for a Carousel variant before storage authorization",async()=>{
    fixture("reel");expect((await beginMediaUploadAction({itemId,variantId,name:"slide.png",mime:"image/png",size:1024})).ok).toBe(false);
    fixture("carousel");expect((await beginMediaUploadAction({itemId,variantId,name:"reel.mp4",mime:"video/mp4",size:1024})).ok).toBe(false);expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("rejects mutation of scheduled variants",async()=>{
    fixture("reel","scheduled");expect((await beginMediaUploadAction({itemId,variantId,name:"reel.mp4",mime:"video/mp4",size:1024})).ok).toBe(false);expect(mocks.sign).not.toHaveBeenCalled();
  });
});
