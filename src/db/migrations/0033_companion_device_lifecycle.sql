ALTER TABLE "companion_image_jobs" DROP CONSTRAINT "companion_image_jobs_device_id_companion_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_device_id_companion_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."companion_devices"("id") ON DELETE cascade ON UPDATE no action;